/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateEvent = /* GraphQL */ `subscription OnCreateEvent(
  $filter: ModelSubscriptionEventFilterInput
  $owner: String
) {
  onCreateEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateEventSubscriptionVariables,
  APITypes.OnCreateEventSubscription
>;
export const onUpdateEvent = /* GraphQL */ `subscription OnUpdateEvent(
  $filter: ModelSubscriptionEventFilterInput
  $owner: String
) {
  onUpdateEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateEventSubscriptionVariables,
  APITypes.OnUpdateEventSubscription
>;
export const onDeleteEvent = /* GraphQL */ `subscription OnDeleteEvent(
  $filter: ModelSubscriptionEventFilterInput
  $owner: String
) {
  onDeleteEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteEventSubscriptionVariables,
  APITypes.OnDeleteEventSubscription
>;
export const onCreateGuestEvent = /* GraphQL */ `subscription OnCreateGuestEvent(
  $filter: ModelSubscriptionGuestEventFilterInput
  $owner: String
) {
  onCreateGuestEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateGuestEventSubscriptionVariables,
  APITypes.OnCreateGuestEventSubscription
>;
export const onUpdateGuestEvent = /* GraphQL */ `subscription OnUpdateGuestEvent(
  $filter: ModelSubscriptionGuestEventFilterInput
  $owner: String
) {
  onUpdateGuestEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateGuestEventSubscriptionVariables,
  APITypes.OnUpdateGuestEventSubscription
>;
export const onDeleteGuestEvent = /* GraphQL */ `subscription OnDeleteGuestEvent(
  $filter: ModelSubscriptionGuestEventFilterInput
  $owner: String
) {
  onDeleteGuestEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteGuestEventSubscriptionVariables,
  APITypes.OnDeleteGuestEventSubscription
>;
export const onCreatePouredDrink = /* GraphQL */ `subscription OnCreatePouredDrink(
  $filter: ModelSubscriptionPouredDrinkFilterInput
  $owner: String
) {
  onCreatePouredDrink(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreatePouredDrinkSubscriptionVariables,
  APITypes.OnCreatePouredDrinkSubscription
>;
export const onUpdatePouredDrink = /* GraphQL */ `subscription OnUpdatePouredDrink(
  $filter: ModelSubscriptionPouredDrinkFilterInput
  $owner: String
) {
  onUpdatePouredDrink(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdatePouredDrinkSubscriptionVariables,
  APITypes.OnUpdatePouredDrinkSubscription
>;
export const onDeletePouredDrink = /* GraphQL */ `subscription OnDeletePouredDrink(
  $filter: ModelSubscriptionPouredDrinkFilterInput
  $owner: String
) {
  onDeletePouredDrink(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeletePouredDrinkSubscriptionVariables,
  APITypes.OnDeletePouredDrinkSubscription
>;
export const onCreateLikedDrink = /* GraphQL */ `subscription OnCreateLikedDrink(
  $filter: ModelSubscriptionLikedDrinkFilterInput
  $owner: String
) {
  onCreateLikedDrink(filter: $filter, owner: $owner) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateLikedDrinkSubscriptionVariables,
  APITypes.OnCreateLikedDrinkSubscription
>;
export const onUpdateLikedDrink = /* GraphQL */ `subscription OnUpdateLikedDrink(
  $filter: ModelSubscriptionLikedDrinkFilterInput
  $owner: String
) {
  onUpdateLikedDrink(filter: $filter, owner: $owner) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateLikedDrinkSubscriptionVariables,
  APITypes.OnUpdateLikedDrinkSubscription
>;
export const onDeleteLikedDrink = /* GraphQL */ `subscription OnDeleteLikedDrink(
  $filter: ModelSubscriptionLikedDrinkFilterInput
  $owner: String
) {
  onDeleteLikedDrink(filter: $filter, owner: $owner) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteLikedDrinkSubscriptionVariables,
  APITypes.OnDeleteLikedDrinkSubscription
>;
export const onCreateCustomRecipe = /* GraphQL */ `subscription OnCreateCustomRecipe(
  $filter: ModelSubscriptionCustomRecipeFilterInput
  $owner: String
) {
  onCreateCustomRecipe(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateCustomRecipeSubscriptionVariables,
  APITypes.OnCreateCustomRecipeSubscription
>;
export const onUpdateCustomRecipe = /* GraphQL */ `subscription OnUpdateCustomRecipe(
  $filter: ModelSubscriptionCustomRecipeFilterInput
  $owner: String
) {
  onUpdateCustomRecipe(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateCustomRecipeSubscriptionVariables,
  APITypes.OnUpdateCustomRecipeSubscription
>;
export const onDeleteCustomRecipe = /* GraphQL */ `subscription OnDeleteCustomRecipe(
  $filter: ModelSubscriptionCustomRecipeFilterInput
  $owner: String
) {
  onDeleteCustomRecipe(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteCustomRecipeSubscriptionVariables,
  APITypes.OnDeleteCustomRecipeSubscription
>;
export const onCreateUserProfile = /* GraphQL */ `subscription OnCreateUserProfile(
  $filter: ModelSubscriptionUserProfileFilterInput
  $owner: String
) {
  onCreateUserProfile(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserProfileSubscriptionVariables,
  APITypes.OnCreateUserProfileSubscription
>;
export const onUpdateUserProfile = /* GraphQL */ `subscription OnUpdateUserProfile(
  $filter: ModelSubscriptionUserProfileFilterInput
  $owner: String
) {
  onUpdateUserProfile(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserProfileSubscriptionVariables,
  APITypes.OnUpdateUserProfileSubscription
>;
export const onDeleteUserProfile = /* GraphQL */ `subscription OnDeleteUserProfile(
  $filter: ModelSubscriptionUserProfileFilterInput
  $owner: String
) {
  onDeleteUserProfile(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserProfileSubscriptionVariables,
  APITypes.OnDeleteUserProfileSubscription
>;
