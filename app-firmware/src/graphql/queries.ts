/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getEvent = /* GraphQL */ `query GetEvent($id: ID!) {
  getEvent(id: $id) {
    id
    name
    description
    location
    startTime
    endTime
    liquorbotId
    inviteCode
    drinkIDs
    owner
    guestOwners
    guests {
      nextToken
      __typename
    }
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.GetEventQueryVariables, APITypes.GetEventQuery>;
export const listEvents = /* GraphQL */ `query ListEvents(
  $filter: ModelEventFilterInput
  $limit: Int
  $nextToken: String
) {
  listEvents(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      location
      startTime
      endTime
      liquorbotId
      inviteCode
      drinkIDs
      owner
      guestOwners
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListEventsQueryVariables,
  APITypes.ListEventsQuery
>;
export const eventsByCode = /* GraphQL */ `query EventsByCode(
  $inviteCode: String!
  $sortDirection: ModelSortDirection
  $filter: ModelEventFilterInput
  $limit: Int
  $nextToken: String
) {
  eventsByCode(
    inviteCode: $inviteCode
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      name
      description
      location
      startTime
      endTime
      liquorbotId
      inviteCode
      drinkIDs
      owner
      guestOwners
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.EventsByCodeQueryVariables,
  APITypes.EventsByCodeQuery
>;
export const getGuestEvent = /* GraphQL */ `query GetGuestEvent($id: ID!) {
  getGuestEvent(id: $id) {
    id
    eventID
    event {
      id
      name
      description
      location
      startTime
      endTime
      liquorbotId
      inviteCode
      drinkIDs
      owner
      guestOwners
      createdAt
      updatedAt
      __typename
    }
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetGuestEventQueryVariables,
  APITypes.GetGuestEventQuery
>;
export const listGuestEvents = /* GraphQL */ `query ListGuestEvents(
  $id: ID
  $filter: ModelGuestEventFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listGuestEvents(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      id
      eventID
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
  APITypes.ListGuestEventsQueryVariables,
  APITypes.ListGuestEventsQuery
>;
export const guestEventsByEvent = /* GraphQL */ `query GuestEventsByEvent(
  $eventID: ID!
  $sortDirection: ModelSortDirection
  $filter: ModelGuestEventFilterInput
  $limit: Int
  $nextToken: String
) {
  guestEventsByEvent(
    eventID: $eventID
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      eventID
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
  APITypes.GuestEventsByEventQueryVariables,
  APITypes.GuestEventsByEventQuery
>;
export const getPouredDrink = /* GraphQL */ `query GetPouredDrink($id: ID!) {
  getPouredDrink(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetPouredDrinkQueryVariables,
  APITypes.GetPouredDrinkQuery
>;
export const listPouredDrinks = /* GraphQL */ `query ListPouredDrinks(
  $filter: ModelPouredDrinkFilterInput
  $limit: Int
  $nextToken: String
) {
  listPouredDrinks(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListPouredDrinksQueryVariables,
  APITypes.ListPouredDrinksQuery
>;
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
    image
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
      image
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
