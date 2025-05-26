// index.js  (PostConfirmation trigger)
const {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  // only on successful sign-up confirmations:
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  try {
    await client.send(
      new AdminAddUserToGroupCommand({
        GroupName:  'USER',
        UserPoolId: event.userPoolId,
        Username:   event.userName,
      })
    );
    console.log(`✔️  User ${event.userName} added to USER group`);
  } catch (err) {
    console.error('❌  Error adding to group:', err);
  }

  return event;
};
