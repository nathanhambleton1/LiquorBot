/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateLikedDrink = /* GraphQL */ `subscription OnCreateLikedDrink(
  $filter: ModelSubscriptionLikedDrinkFilterInput
  $userID: String
) {
  onCreateLikedDrink(filter: $filter, userID: $userID) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateLikedDrinkSubscriptionVariables,
  APITypes.OnCreateLikedDrinkSubscription
>;
export const onUpdateLikedDrink = /* GraphQL */ `subscription OnUpdateLikedDrink(
  $filter: ModelSubscriptionLikedDrinkFilterInput
  $userID: String
) {
  onUpdateLikedDrink(filter: $filter, userID: $userID) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateLikedDrinkSubscriptionVariables,
  APITypes.OnUpdateLikedDrinkSubscription
>;
export const onDeleteLikedDrink = /* GraphQL */ `subscription OnDeleteLikedDrink(
  $filter: ModelSubscriptionLikedDrinkFilterInput
  $userID: String
) {
  onDeleteLikedDrink(filter: $filter, userID: $userID) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteLikedDrinkSubscriptionVariables,
  APITypes.OnDeleteLikedDrinkSubscription
>;
