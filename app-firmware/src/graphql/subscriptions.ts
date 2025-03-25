/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateDrink = /* GraphQL */ `subscription OnCreateDrink($filter: ModelSubscriptionDrinkFilterInput) {
  onCreateDrink(filter: $filter) {
    id
    name
    category
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateDrinkSubscriptionVariables,
  APITypes.OnCreateDrinkSubscription
>;
export const onUpdateDrink = /* GraphQL */ `subscription OnUpdateDrink($filter: ModelSubscriptionDrinkFilterInput) {
  onUpdateDrink(filter: $filter) {
    id
    name
    category
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateDrinkSubscriptionVariables,
  APITypes.OnUpdateDrinkSubscription
>;
export const onDeleteDrink = /* GraphQL */ `subscription OnDeleteDrink($filter: ModelSubscriptionDrinkFilterInput) {
  onDeleteDrink(filter: $filter) {
    id
    name
    category
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteDrinkSubscriptionVariables,
  APITypes.OnDeleteDrinkSubscription
>;
export const onCreateFavorite = /* GraphQL */ `subscription OnCreateFavorite(
  $filter: ModelSubscriptionFavoriteFilterInput
  $owner: String
) {
  onCreateFavorite(filter: $filter, owner: $owner) {
    id
    userSub
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateFavoriteSubscriptionVariables,
  APITypes.OnCreateFavoriteSubscription
>;
export const onUpdateFavorite = /* GraphQL */ `subscription OnUpdateFavorite(
  $filter: ModelSubscriptionFavoriteFilterInput
  $owner: String
) {
  onUpdateFavorite(filter: $filter, owner: $owner) {
    id
    userSub
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateFavoriteSubscriptionVariables,
  APITypes.OnUpdateFavoriteSubscription
>;
export const onDeleteFavorite = /* GraphQL */ `subscription OnDeleteFavorite(
  $filter: ModelSubscriptionFavoriteFilterInput
  $owner: String
) {
  onDeleteFavorite(filter: $filter, owner: $owner) {
    id
    userSub
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteFavoriteSubscriptionVariables,
  APITypes.OnDeleteFavoriteSubscription
>;
