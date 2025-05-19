/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createEvent = /* GraphQL */ `mutation CreateEvent(
  $input: CreateEventInput!
  $condition: ModelEventConditionInput
) {
  createEvent(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateEventMutationVariables,
  APITypes.CreateEventMutation
>;
export const updateEvent = /* GraphQL */ `mutation UpdateEvent(
  $input: UpdateEventInput!
  $condition: ModelEventConditionInput
) {
  updateEvent(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateEventMutationVariables,
  APITypes.UpdateEventMutation
>;
export const deleteEvent = /* GraphQL */ `mutation DeleteEvent(
  $input: DeleteEventInput!
  $condition: ModelEventConditionInput
) {
  deleteEvent(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteEventMutationVariables,
  APITypes.DeleteEventMutation
>;
export const createGuestEvent = /* GraphQL */ `mutation CreateGuestEvent(
  $input: CreateGuestEventInput!
  $condition: ModelGuestEventConditionInput
) {
  createGuestEvent(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateGuestEventMutationVariables,
  APITypes.CreateGuestEventMutation
>;
export const updateGuestEvent = /* GraphQL */ `mutation UpdateGuestEvent(
  $input: UpdateGuestEventInput!
  $condition: ModelGuestEventConditionInput
) {
  updateGuestEvent(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateGuestEventMutationVariables,
  APITypes.UpdateGuestEventMutation
>;
export const deleteGuestEvent = /* GraphQL */ `mutation DeleteGuestEvent(
  $input: DeleteGuestEventInput!
  $condition: ModelGuestEventConditionInput
) {
  deleteGuestEvent(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteGuestEventMutationVariables,
  APITypes.DeleteGuestEventMutation
>;
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
    image
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
    image
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
    image
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
export const joinEvent = /* GraphQL */ `mutation JoinEvent($inviteCode: String!) {
  joinEvent(inviteCode: $inviteCode) {
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
` as GeneratedMutation<
  APITypes.JoinEventMutationVariables,
  APITypes.JoinEventMutation
>;
export const leaveEvent = /* GraphQL */ `mutation LeaveEvent($eventId: ID!) {
  leaveEvent(eventId: $eventId) {
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
` as GeneratedMutation<
  APITypes.LeaveEventMutationVariables,
  APITypes.LeaveEventMutation
>;
