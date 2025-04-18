/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getLikedDrink = /* GraphQL */ `query GetLikedDrink($id: ID!) {
  getLikedDrink(id: $id) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetLikedDrinkQueryVariables,
  APITypes.GetLikedDrinkQuery
>;
export const listLikedDrinks = /* GraphQL */ `query ListLikedDrinks(
  $filter: ModelLikedDrinkFilterInput
  $limit: Int
  $nextToken: String
) {
  listLikedDrinks(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      userID
      drinkID
      createdAt
      updatedAt
      owner
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListLikedDrinksQueryVariables,
  APITypes.ListLikedDrinksQuery
>;
export const getCustomRecipe = /* GraphQL */ `query GetCustomRecipe($id: ID!) {
  getCustomRecipe(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetCustomRecipeQueryVariables,
  APITypes.GetCustomRecipeQuery
>;
export const listCustomRecipes = /* GraphQL */ `query ListCustomRecipes(
  $filter: ModelCustomRecipeFilterInput
  $limit: Int
  $nextToken: String
) {
  listCustomRecipes(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      createdAt
      updatedAt
      owner
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListCustomRecipesQueryVariables,
  APITypes.ListCustomRecipesQuery
>;
export const getUserProfile = /* GraphQL */ `query GetUserProfile($id: ID!) {
  getUserProfile(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetUserProfileQueryVariables,
  APITypes.GetUserProfileQuery
>;
export const listUserProfiles = /* GraphQL */ `query ListUserProfiles(
  $filter: ModelUserProfileFilterInput
  $limit: Int
  $nextToken: String
) {
  listUserProfiles(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserProfilesQueryVariables,
  APITypes.ListUserProfilesQuery
>;
