const { IoTClient, AttachPolicyCommand } = require("@aws-sdk/client-iot");

const REGION      = process.env.AWS_REGION || "us-east-1";
const POLICY_NAME = process.env.POLICY_NAME || "Amplify-App-Policy";

exports.handler = async (event) => {
  const REGION      = process.env.AWS_REGION || "us-east-1";
  const POLICY_NAME = process.env.POLICY_NAME || "Amplify-App-Policy";

  console.log("Post-confirmation trigger event:", JSON.stringify(event));

  const sub        = event.request.userAttributes.sub;
  const identityId = `${REGION}:${sub}`;

  const iot = new IoTClient({ region: REGION });

  try {
    await iot.send(new AttachPolicyCommand({
      policyName: POLICY_NAME,
      target: identityId,
    }));
    console.log("✔ Policy attached to", identityId);
  } catch (err) {
    if (err.name === "ResourceAlreadyExistsException") {
      console.log("⚠ Policy already attached");
    } else {
      console.error("❌ Attach failed", err);
      throw err;
    }
  }

  return event;
};
