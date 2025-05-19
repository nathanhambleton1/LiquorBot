/* Amplify Params - DO NOT EDIT
   API_LIQUORBOT_EVENTTABLE_ARN
   API_LIQUORBOT_EVENTTABLE_NAME
   API_LIQUORBOT_GRAPHQLAPIIDOUTPUT
   API_LIQUORBOT_GUESTEVENTTABLE_ARN
   API_LIQUORBOT_GUESTEVENTTABLE_NAME
   ENV
   REGION
Amplify Params - DO NOT EDIT */

/* eslint-disable */
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

/* -------- constants -------- */
const TABLE  = process.env.API_LIQUORBOT_EVENTTABLE_NAME;        // Event table
const GUESTS = process.env.API_LIQUORBOT_GUESTEVENTTABLE_NAME;   // GuestEvent table
const INDEX  = "byCode";                                         // GSI on inviteCode

/* single shared client */
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/* ===== handler ===== */
exports.handler = async (event) => {
  const username = event.identity.username;
  const code     = event.arguments.inviteCode.toUpperCase();

  /* 1 ▸ look up the event by invite code */
  const { Items } = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: INDEX,
    KeyConditionExpression: "inviteCode = :c",
    ExpressionAttributeValues: { ":c": code },
  }));
  if (!Items || Items.length === 0) {
    throw new Error("Invalid code");
  }
  const ev = Items[0];

  /* 2 ▸ if user already joined, just return the event */
  if (ev.guestOwners?.includes(username)) {
    return ev;
  }

  /* 3 ▸ append user to guestOwners atomically */
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id: ev.id },
    UpdateExpression:
      "SET guestOwners = list_append(if_not_exists(guestOwners, :empty), :me)",
    ExpressionAttributeValues: {
      ":me":    [username],
      ":empty": [],
    },
  }));

  /* 4 ▸ create GuestEvent row (ignore if it already exists) */
  try {
    const nowISO = new Date().toISOString();
    const nowMS  = Date.now();

    await ddb.send(new PutCommand({
      TableName: GUESTS,
      Item: {
        id:             `${ev.id}#${username}`,   // composite PK
        eventID:        ev.id,
        owner:          username,

        /* required @model metadata ------------------------- */
        createdAt:      nowISO,
        updatedAt:      nowISO,
        _version:       1,
        _lastChangedAt: nowMS,
      },
      ConditionExpression: "attribute_not_exists(id)",
    }));
  } catch (err) {
    if (err.name !== "ConditionalCheckFailedException") {
      throw err;            // re‑throw anything except "duplicate row"
    }
  }

  /* 5 ▸ return the updated event object */
  return {
    ...ev,
    guestOwners: [...(ev.guestOwners ?? []), username],
  };
};
