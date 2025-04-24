/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createPouredDrink = /* GraphQL */ `mutation CreatePouredDrink(
  $input: CreatePouredDrinkInput!
  $condition: ModelPouredDrinkConditionInput
) {
  createPouredDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    drinkName
    volume
    timestamp
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreatePouredDrinkMutationVariables,
  APITypes.CreatePouredDrinkMutation
>;
export const updatePouredDrink = /* GraphQL */ `mutation UpdatePouredDrink(
  $input: UpdatePouredDrinkInput!
  $condition: ModelPouredDrinkConditionInput
) {
  updatePouredDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    drinkName
    volume
    timestamp
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdatePouredDrinkMutationVariables,
  APITypes.UpdatePouredDrinkMutation
>;
export const deletePouredDrink = /* GraphQL */ `mutation DeletePouredDrink(
  $input: DeletePouredDrinkInput!
  $condition: ModelPouredDrinkConditionInput
) {
  deletePouredDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    drinkName
    volume
    timestamp
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeletePouredDrinkMutationVariables,
  APITypes.DeletePouredDrinkMutation
>;
export const createLikedDrink = /* GraphQL */ `mutation CreateLikedDrink(
  $input: CreateLikedDrinkInput!
  $condition: ModelLikedDrinkConditionInput
) {
  createLikedDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateLikedDrinkMutationVariables,
  APITypes.CreateLikedDrinkMutation
>;
export const updateLikedDrink = /* GraphQL */ `mutation UpdateLikedDrink(
  $input: UpdateLikedDrinkInput!
  $condition: ModelLikedDrinkConditionInput
) {
  updateLikedDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateLikedDrinkMutationVariables,
  APITypes.UpdateLikedDrinkMutation
>;
export const deleteLikedDrink = /* GraphQL */ `mutation DeleteLikedDrink(
  $input: DeleteLikedDrinkInput!
  $condition: ModelLikedDrinkConditionInput
) {
  deleteLikedDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteLikedDrinkMutationVariables,
  APITypes.DeleteLikedDrinkMutation
>;
export const createCustomRecipe = /* GraphQL */ `mutation CreateCustomRecipe(
  $input: CreateCustomRecipeInput!
  $condition: ModelCustomRecipeConditionInput
) {
  createCustomRecipe(input: $input, condition: $condition) {
    id
    name
    description
    ingredients {
      ingredientID
      amount
      priority
      __typename
    }
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateCustomRecipeMutationVariables,
  APITypes.CreateCustomRecipeMutation
>;
export const updateCustomRecipe = /* GraphQL */ `mutation UpdateCustomRecipe(
  $input: UpdateCustomRecipeInput!
  $condition: ModelCustomRecipeConditionInput
) {
  updateCustomRecipe(input: $input, condition: $condition) {
    id
    name
    description
    ingredients {
      ingredientID
      amount
      priority
      __typename
    }
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateCustomRecipeMutationVariables,
  APITypes.UpdateCustomRecipeMutation
>;
export const deleteCustomRecipe = /* GraphQL */ `mutation DeleteCustomRecipe(
  $input: DeleteCustomRecipeInput!
  $condition: ModelCustomRecipeConditionInput
) {
  deleteCustomRecipe(input: $input, condition: $condition) {
    id
    name
    description
    ingredients {
      ingredientID
      amount
      priority
      __typename
    }
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteCustomRecipeMutationVariables,
  APITypes.DeleteCustomRecipeMutation
>;
export const createUserProfile = /* GraphQL */ `mutation CreateUserProfile(
  $input: CreateUserProfileInput!
  $condition: ModelUserProfileConditionInput
) {
  createUserProfile(input: $input, condition: $condition) {
    id
    username
    bio
    role
    profilePicture
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateUserProfileMutationVariables,
  APITypes.CreateUserProfileMutation
>;
export const updateUserProfile = /* GraphQL */ `mutation UpdateUserProfile(
  $input: UpdateUserProfileInput!
  $condition: ModelUserProfileConditionInput
) {
  updateUserProfile(input: $input, condition: $condition) {
    id
    username
    bio
    role
    profilePicture
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateUserProfileMutationVariables,
  APITypes.UpdateUserProfileMutation
>;
export const deleteUserProfile = /* GraphQL */ `mutation DeleteUserProfile(
  $input: DeleteUserProfileInput!
  $condition: ModelUserProfileConditionInput
) {
  deleteUserProfile(input: $input, condition: $condition) {
    id
    username
    bio
    role
    profilePicture
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteUserProfileMutationVariables,
  APITypes.DeleteUserProfileMutation
>;
