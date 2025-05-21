export type AmplifyDependentResourcesAttributes = {
  "api": {
    "LiquorBot": {
      "GraphQLAPIEndpointOutput": "string",
      "GraphQLAPIIdOutput": "string",
      "GraphQLAPIKeyOutput": "string"
    }
  },
  "auth": {
    "LiquorBot": {
      "AppClientID": "string",
      "AppClientIDWeb": "string",
      "IdentityPoolId": "string",
      "IdentityPoolName": "string",
      "UserPoolArn": "string",
      "UserPoolId": "string",
      "UserPoolName": "string"
    },
    "userPoolGroups": {
      "EventAttendeeGroupRole": "string",
      "EventManagerGroupRole": "string",
      "OwnerGroupRole": "string"
    }
  },
  "function": {
    "joinEventFunction": {
      "Arn": "string",
      "LambdaExecutionRole": "string",
      "LambdaExecutionRoleArn": "string",
      "Name": "string",
      "Region": "string"
    },
    "leaveEventFunction": {
      "Arn": "string",
      "LambdaExecutionRole": "string",
      "LambdaExecutionRoleArn": "string",
      "Name": "string",
      "Region": "string"
    }
  },
  "storage": {
    "s3liquorbotstorage8cb6bcd8": {
      "BucketName": "string",
      "Region": "string"
    }
  }
}