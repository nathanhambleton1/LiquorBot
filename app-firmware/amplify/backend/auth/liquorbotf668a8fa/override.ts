import {
  AmplifyAuthCognitoStackTemplate,
  AmplifyProjectInfo,
} from '@aws-amplify/cli-extensibility-helper';

export function override(
  resources: AmplifyAuthCognitoStackTemplate,
  amplifyProjectInfo: AmplifyProjectInfo
) {
  // Make sure the schema is an array before modifying
  if (Array.isArray(resources.userPool.schema)) {
    resources.userPool.schema.push({
      attributeDataType: 'String',
      mutable: true,
      name: 'bio',
      required: false,
      stringAttributeConstraints: {
        minLength: '0',
        maxLength: '100',
      },
    });
  }
}
