/* Amplify Params - DO NOT EDIT
	API_LIQUORBOT_EVENTTABLE_ARN
	API_LIQUORBOT_EVENTTABLE_NAME
	API_LIQUORBOT_GRAPHQLAPIIDOUTPUT
	API_LIQUORBOT_GUESTEVENTTABLE_ARN
	API_LIQUORBOT_GUESTEVENTTABLE_NAME
	ENV
	REGION
Amplify Params - DO NOT EDIT */// leave-event-function.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

const ddb         = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENT_TABLE = process.env.API_LIQUORBOT_EVENTTABLE_NAME;
const GUEST_TABLE = process.env.API_LIQUORBOT_GUESTEVENTTABLE_NAME;

exports.handler = async (event) => {
  const username = event.identity.username;     // current signed-in user
  const eventId  = event.arguments.eventId;     // ID passed from client

  try {
    /* 1.-- Fetch the event so we have the full record */
    const { Item: evt } = await ddb.send(new GetCommand({
      TableName : EVENT_TABLE,
      Key       : { id: eventId }
    }));

    if (!evt)                       throw new Error("Event not found");
    if (evt.owner === username)     throw new Error("Host cannot leave their own event");

    /* 2.-- Make sure the user *is* a guest */
    const guests = evt.guestOwners ?? [];
    if (!guests.includes(username)) throw new Error("You are not a guest of this event");

    /* 3.-- Remove user from guestOwners list */
    const updatedGuests = guests.filter(u => u !== username);

    await ddb.send(new UpdateCommand({
      TableName : EVENT_TABLE,
      Key       : { id: eventId },
      UpdateExpression         : "SET guestOwners = :g",
      ExpressionAttributeValues: { ":g": updatedGuests }
    }));

    /* 4.-- Delete the GuestEvent record (if you used eventId#username as the PK)  */
    const guestId = `${eventId}#${username}`;
    await ddb.send(new DeleteCommand({
      TableName: GUEST_TABLE,
      Key      : { id: guestId }
    }));

    /* 5.-- Return the full (now-updated) event so the client cache stays correct */
    return {
      ...evt,
      guestOwners: updatedGuests
    };

  } catch (err) {
    console.error("Leave event error:", err);
    throw new Error(err.message || "Failed to leave event");
  }
};