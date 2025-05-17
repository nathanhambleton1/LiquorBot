/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateGuestEventInput = {
  id?: string | null,
  eventID: string,
};

export type ModelGuestEventConditionInput = {
  eventID?: ModelIDInput | null,
  and?: Array< ModelGuestEventConditionInput | null > | null,
  or?: Array< ModelGuestEventConditionInput | null > | null,
  not?: ModelGuestEventConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type ModelIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
  _null = "_null",
}


export type ModelSizeInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
};

export type ModelStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export type GuestEvent = {
  __typename: "GuestEvent",
  id: string,
  eventID: string,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type UpdateGuestEventInput = {
  id: string,
  eventID?: string | null,
};

export type DeleteGuestEventInput = {
  id: string,
};

export type CreateEventInput = {
  id?: string | null,
  name: string,
  description?: string | null,
  location?: string | null,
  startTime: string,
  endTime: string,
  liquorbotId: number,
  inviteCode: string,
  drinkIDs?: Array< number > | null,
};

export type ModelEventConditionInput = {
  name?: ModelStringInput | null,
  description?: ModelStringInput | null,
  location?: ModelStringInput | null,
  startTime?: ModelStringInput | null,
  endTime?: ModelStringInput | null,
  liquorbotId?: ModelIntInput | null,
  inviteCode?: ModelStringInput | null,
  drinkIDs?: ModelIntInput | null,
  and?: Array< ModelEventConditionInput | null > | null,
  or?: Array< ModelEventConditionInput | null > | null,
  not?: ModelEventConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type ModelIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type Event = {
  __typename: "Event",
  id: string,
  name: string,
  description?: string | null,
  location?: string | null,
  startTime: string,
  endTime: string,
  liquorbotId: number,
  inviteCode: string,
  drinkIDs?: Array< number > | null,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type UpdateEventInput = {
  id: string,
  name?: string | null,
  description?: string | null,
  location?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  liquorbotId?: number | null,
  inviteCode?: string | null,
  drinkIDs?: Array< number > | null,
};

export type DeleteEventInput = {
  id: string,
};

export type CreatePouredDrinkInput = {
  id?: string | null,
  userID: string,
  drinkID: number,
  drinkName?: string | null,
  volume?: number | null,
  timestamp: string,
};

export type ModelPouredDrinkConditionInput = {
  userID?: ModelIDInput | null,
  drinkID?: ModelIntInput | null,
  drinkName?: ModelStringInput | null,
  volume?: ModelFloatInput | null,
  timestamp?: ModelStringInput | null,
  and?: Array< ModelPouredDrinkConditionInput | null > | null,
  or?: Array< ModelPouredDrinkConditionInput | null > | null,
  not?: ModelPouredDrinkConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type ModelFloatInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type PouredDrink = {
  __typename: "PouredDrink",
  id: string,
  userID: string,
  drinkID: number,
  drinkName?: string | null,
  volume?: number | null,
  timestamp: string,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type UpdatePouredDrinkInput = {
  id: string,
  userID?: string | null,
  drinkID?: number | null,
  drinkName?: string | null,
  volume?: number | null,
  timestamp?: string | null,
};

export type DeletePouredDrinkInput = {
  id: string,
};

export type CreateLikedDrinkInput = {
  id?: string | null,
  userID?: string | null,
  drinkID?: number | null,
  createdAt?: string | null,
};

export type ModelLikedDrinkConditionInput = {
  userID?: ModelIDInput | null,
  drinkID?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelLikedDrinkConditionInput | null > | null,
  or?: Array< ModelLikedDrinkConditionInput | null > | null,
  not?: ModelLikedDrinkConditionInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type LikedDrink = {
  __typename: "LikedDrink",
  id: string,
  userID?: string | null,
  drinkID?: number | null,
  createdAt?: string | null,
  updatedAt: string,
  owner?: string | null,
};

export type UpdateLikedDrinkInput = {
  id: string,
  userID?: string | null,
  drinkID?: number | null,
  createdAt?: string | null,
};

export type DeleteLikedDrinkInput = {
  id: string,
};

export type CreateCustomRecipeInput = {
  id?: string | null,
  name: string,
  description?: string | null,
  ingredients?: Array< RecipeIngredientInput > | null,
  createdAt?: string | null,
  image?: string | null,
};

export type RecipeIngredientInput = {
  ingredientID?: string | null,
  amount?: number | null,
  priority?: number | null,
};

export type ModelCustomRecipeConditionInput = {
  name?: ModelStringInput | null,
  description?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  image?: ModelStringInput | null,
  and?: Array< ModelCustomRecipeConditionInput | null > | null,
  or?: Array< ModelCustomRecipeConditionInput | null > | null,
  not?: ModelCustomRecipeConditionInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type CustomRecipe = {
  __typename: "CustomRecipe",
  id: string,
  name: string,
  description?: string | null,
  ingredients?:  Array<RecipeIngredient > | null,
  createdAt?: string | null,
  image?: string | null,
  updatedAt: string,
  owner?: string | null,
};

export type RecipeIngredient = {
  __typename: "RecipeIngredient",
  ingredientID?: string | null,
  amount?: number | null,
  priority?: number | null,
};

export type UpdateCustomRecipeInput = {
  id: string,
  name?: string | null,
  description?: string | null,
  ingredients?: Array< RecipeIngredientInput > | null,
  createdAt?: string | null,
  image?: string | null,
};

export type DeleteCustomRecipeInput = {
  id: string,
};

export type CreateUserProfileInput = {
  id?: string | null,
  username?: string | null,
  bio?: string | null,
  role?: string | null,
  profilePicture?: string | null,
};

export type ModelUserProfileConditionInput = {
  username?: ModelStringInput | null,
  bio?: ModelStringInput | null,
  role?: ModelStringInput | null,
  profilePicture?: ModelStringInput | null,
  and?: Array< ModelUserProfileConditionInput | null > | null,
  or?: Array< ModelUserProfileConditionInput | null > | null,
  not?: ModelUserProfileConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type UserProfile = {
  __typename: "UserProfile",
  id: string,
  username?: string | null,
  bio?: string | null,
  role?: string | null,
  profilePicture?: string | null,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type UpdateUserProfileInput = {
  id: string,
  username?: string | null,
  bio?: string | null,
  role?: string | null,
  profilePicture?: string | null,
};

export type DeleteUserProfileInput = {
  id: string,
};

export type ModelGuestEventFilterInput = {
  id?: ModelIDInput | null,
  eventID?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelGuestEventFilterInput | null > | null,
  or?: Array< ModelGuestEventFilterInput | null > | null,
  not?: ModelGuestEventFilterInput | null,
  owner?: ModelStringInput | null,
};

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type ModelGuestEventConnection = {
  __typename: "ModelGuestEventConnection",
  items:  Array<GuestEvent | null >,
  nextToken?: string | null,
};

export type ModelEventFilterInput = {
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  description?: ModelStringInput | null,
  location?: ModelStringInput | null,
  startTime?: ModelStringInput | null,
  endTime?: ModelStringInput | null,
  liquorbotId?: ModelIntInput | null,
  inviteCode?: ModelStringInput | null,
  drinkIDs?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelEventFilterInput | null > | null,
  or?: Array< ModelEventFilterInput | null > | null,
  not?: ModelEventFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelEventConnection = {
  __typename: "ModelEventConnection",
  items:  Array<Event | null >,
  nextToken?: string | null,
};

export type ModelPouredDrinkFilterInput = {
  id?: ModelIDInput | null,
  userID?: ModelIDInput | null,
  drinkID?: ModelIntInput | null,
  drinkName?: ModelStringInput | null,
  volume?: ModelFloatInput | null,
  timestamp?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelPouredDrinkFilterInput | null > | null,
  or?: Array< ModelPouredDrinkFilterInput | null > | null,
  not?: ModelPouredDrinkFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelPouredDrinkConnection = {
  __typename: "ModelPouredDrinkConnection",
  items:  Array<PouredDrink | null >,
  nextToken?: string | null,
};

export type ModelLikedDrinkFilterInput = {
  id?: ModelIDInput | null,
  userID?: ModelIDInput | null,
  drinkID?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelLikedDrinkFilterInput | null > | null,
  or?: Array< ModelLikedDrinkFilterInput | null > | null,
  not?: ModelLikedDrinkFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelLikedDrinkConnection = {
  __typename: "ModelLikedDrinkConnection",
  items:  Array<LikedDrink | null >,
  nextToken?: string | null,
};

export type ModelCustomRecipeFilterInput = {
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  description?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  image?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelCustomRecipeFilterInput | null > | null,
  or?: Array< ModelCustomRecipeFilterInput | null > | null,
  not?: ModelCustomRecipeFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelCustomRecipeConnection = {
  __typename: "ModelCustomRecipeConnection",
  items:  Array<CustomRecipe | null >,
  nextToken?: string | null,
};

export type ModelUserProfileFilterInput = {
  id?: ModelIDInput | null,
  username?: ModelStringInput | null,
  bio?: ModelStringInput | null,
  role?: ModelStringInput | null,
  profilePicture?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelUserProfileFilterInput | null > | null,
  or?: Array< ModelUserProfileFilterInput | null > | null,
  not?: ModelUserProfileFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelUserProfileConnection = {
  __typename: "ModelUserProfileConnection",
  items:  Array<UserProfile | null >,
  nextToken?: string | null,
};

export type ModelSubscriptionGuestEventFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  eventID?: ModelSubscriptionIDInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionGuestEventFilterInput | null > | null,
  or?: Array< ModelSubscriptionGuestEventFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionEventFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  description?: ModelSubscriptionStringInput | null,
  location?: ModelSubscriptionStringInput | null,
  startTime?: ModelSubscriptionStringInput | null,
  endTime?: ModelSubscriptionStringInput | null,
  liquorbotId?: ModelSubscriptionIntInput | null,
  inviteCode?: ModelSubscriptionStringInput | null,
  drinkIDs?: ModelSubscriptionIntInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionEventFilterInput | null > | null,
  or?: Array< ModelSubscriptionEventFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  in?: Array< number | null > | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionPouredDrinkFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  userID?: ModelSubscriptionIDInput | null,
  drinkID?: ModelSubscriptionIntInput | null,
  drinkName?: ModelSubscriptionStringInput | null,
  volume?: ModelSubscriptionFloatInput | null,
  timestamp?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionPouredDrinkFilterInput | null > | null,
  or?: Array< ModelSubscriptionPouredDrinkFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionFloatInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  in?: Array< number | null > | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionLikedDrinkFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  userID?: ModelSubscriptionIDInput | null,
  drinkID?: ModelSubscriptionIntInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionLikedDrinkFilterInput | null > | null,
  or?: Array< ModelSubscriptionLikedDrinkFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionCustomRecipeFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  description?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  image?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionCustomRecipeFilterInput | null > | null,
  or?: Array< ModelSubscriptionCustomRecipeFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionUserProfileFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  username?: ModelSubscriptionStringInput | null,
  bio?: ModelSubscriptionStringInput | null,
  role?: ModelSubscriptionStringInput | null,
  profilePicture?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionUserProfileFilterInput | null > | null,
  or?: Array< ModelSubscriptionUserProfileFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type CreateGuestEventMutationVariables = {
  input: CreateGuestEventInput,
  condition?: ModelGuestEventConditionInput | null,
};

export type CreateGuestEventMutation = {
  createGuestEvent?:  {
    __typename: "GuestEvent",
    id: string,
    eventID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateGuestEventMutationVariables = {
  input: UpdateGuestEventInput,
  condition?: ModelGuestEventConditionInput | null,
};

export type UpdateGuestEventMutation = {
  updateGuestEvent?:  {
    __typename: "GuestEvent",
    id: string,
    eventID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteGuestEventMutationVariables = {
  input: DeleteGuestEventInput,
  condition?: ModelGuestEventConditionInput | null,
};

export type DeleteGuestEventMutation = {
  deleteGuestEvent?:  {
    __typename: "GuestEvent",
    id: string,
    eventID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateEventMutationVariables = {
  input: CreateEventInput,
  condition?: ModelEventConditionInput | null,
};

export type CreateEventMutation = {
  createEvent?:  {
    __typename: "Event",
    id: string,
    name: string,
    description?: string | null,
    location?: string | null,
    startTime: string,
    endTime: string,
    liquorbotId: number,
    inviteCode: string,
    drinkIDs?: Array< number > | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateEventMutationVariables = {
  input: UpdateEventInput,
  condition?: ModelEventConditionInput | null,
};

export type UpdateEventMutation = {
  updateEvent?:  {
    __typename: "Event",
    id: string,
    name: string,
    description?: string | null,
    location?: string | null,
    startTime: string,
    endTime: string,
    liquorbotId: number,
    inviteCode: string,
    drinkIDs?: Array< number > | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteEventMutationVariables = {
  input: DeleteEventInput,
  condition?: ModelEventConditionInput | null,
};

export type DeleteEventMutation = {
  deleteEvent?:  {
    __typename: "Event",
    id: string,
    name: string,
    description?: string | null,
    location?: string | null,
    startTime: string,
    endTime: string,
    liquorbotId: number,
    inviteCode: string,
    drinkIDs?: Array< number > | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreatePouredDrinkMutationVariables = {
  input: CreatePouredDrinkInput,
  condition?: ModelPouredDrinkConditionInput | null,
};

export type CreatePouredDrinkMutation = {
  createPouredDrink?:  {
    __typename: "PouredDrink",
    id: string,
    userID: string,
    drinkID: number,
    drinkName?: string | null,
    volume?: number | null,
    timestamp: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdatePouredDrinkMutationVariables = {
  input: UpdatePouredDrinkInput,
  condition?: ModelPouredDrinkConditionInput | null,
};

export type UpdatePouredDrinkMutation = {
  updatePouredDrink?:  {
    __typename: "PouredDrink",
    id: string,
    userID: string,
    drinkID: number,
    drinkName?: string | null,
    volume?: number | null,
    timestamp: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeletePouredDrinkMutationVariables = {
  input: DeletePouredDrinkInput,
  condition?: ModelPouredDrinkConditionInput | null,
};

export type DeletePouredDrinkMutation = {
  deletePouredDrink?:  {
    __typename: "PouredDrink",
    id: string,
    userID: string,
    drinkID: number,
    drinkName?: string | null,
    volume?: number | null,
    timestamp: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateLikedDrinkMutationVariables = {
  input: CreateLikedDrinkInput,
  condition?: ModelLikedDrinkConditionInput | null,
};

export type CreateLikedDrinkMutation = {
  createLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateLikedDrinkMutationVariables = {
  input: UpdateLikedDrinkInput,
  condition?: ModelLikedDrinkConditionInput | null,
};

export type UpdateLikedDrinkMutation = {
  updateLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteLikedDrinkMutationVariables = {
  input: DeleteLikedDrinkInput,
  condition?: ModelLikedDrinkConditionInput | null,
};

export type DeleteLikedDrinkMutation = {
  deleteLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateCustomRecipeMutationVariables = {
  input: CreateCustomRecipeInput,
  condition?: ModelCustomRecipeConditionInput | null,
};

export type CreateCustomRecipeMutation = {
  createCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name: string,
    description?: string | null,
    ingredients?:  Array< {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } > | null,
    createdAt?: string | null,
    image?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateCustomRecipeMutationVariables = {
  input: UpdateCustomRecipeInput,
  condition?: ModelCustomRecipeConditionInput | null,
};

export type UpdateCustomRecipeMutation = {
  updateCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name: string,
    description?: string | null,
    ingredients?:  Array< {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } > | null,
    createdAt?: string | null,
    image?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteCustomRecipeMutationVariables = {
  input: DeleteCustomRecipeInput,
  condition?: ModelCustomRecipeConditionInput | null,
};

export type DeleteCustomRecipeMutation = {
  deleteCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name: string,
    description?: string | null,
    ingredients?:  Array< {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } > | null,
    createdAt?: string | null,
    image?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateUserProfileMutationVariables = {
  input: CreateUserProfileInput,
  condition?: ModelUserProfileConditionInput | null,
};

export type CreateUserProfileMutation = {
  createUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateUserProfileMutationVariables = {
  input: UpdateUserProfileInput,
  condition?: ModelUserProfileConditionInput | null,
};

export type UpdateUserProfileMutation = {
  updateUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteUserProfileMutationVariables = {
  input: DeleteUserProfileInput,
  condition?: ModelUserProfileConditionInput | null,
};

export type DeleteUserProfileMutation = {
  deleteUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type GetGuestEventQueryVariables = {
  id: string,
};

export type GetGuestEventQuery = {
  getGuestEvent?:  {
    __typename: "GuestEvent",
    id: string,
    eventID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListGuestEventsQueryVariables = {
  id?: string | null,
  filter?: ModelGuestEventFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListGuestEventsQuery = {
  listGuestEvents?:  {
    __typename: "ModelGuestEventConnection",
    items:  Array< {
      __typename: "GuestEvent",
      id: string,
      eventID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GuestEventsByEventQueryVariables = {
  eventID: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelGuestEventFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type GuestEventsByEventQuery = {
  guestEventsByEvent?:  {
    __typename: "ModelGuestEventConnection",
    items:  Array< {
      __typename: "GuestEvent",
      id: string,
      eventID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetEventQueryVariables = {
  id: string,
};

export type GetEventQuery = {
  getEvent?:  {
    __typename: "Event",
    id: string,
    name: string,
    description?: string | null,
    location?: string | null,
    startTime: string,
    endTime: string,
    liquorbotId: number,
    inviteCode: string,
    drinkIDs?: Array< number > | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListEventsQueryVariables = {
  filter?: ModelEventFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListEventsQuery = {
  listEvents?:  {
    __typename: "ModelEventConnection",
    items:  Array< {
      __typename: "Event",
      id: string,
      name: string,
      description?: string | null,
      location?: string | null,
      startTime: string,
      endTime: string,
      liquorbotId: number,
      inviteCode: string,
      drinkIDs?: Array< number > | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetPouredDrinkQueryVariables = {
  id: string,
};

export type GetPouredDrinkQuery = {
  getPouredDrink?:  {
    __typename: "PouredDrink",
    id: string,
    userID: string,
    drinkID: number,
    drinkName?: string | null,
    volume?: number | null,
    timestamp: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListPouredDrinksQueryVariables = {
  filter?: ModelPouredDrinkFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListPouredDrinksQuery = {
  listPouredDrinks?:  {
    __typename: "ModelPouredDrinkConnection",
    items:  Array< {
      __typename: "PouredDrink",
      id: string,
      userID: string,
      drinkID: number,
      drinkName?: string | null,
      volume?: number | null,
      timestamp: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetLikedDrinkQueryVariables = {
  id: string,
};

export type GetLikedDrinkQuery = {
  getLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListLikedDrinksQueryVariables = {
  filter?: ModelLikedDrinkFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListLikedDrinksQuery = {
  listLikedDrinks?:  {
    __typename: "ModelLikedDrinkConnection",
    items:  Array< {
      __typename: "LikedDrink",
      id: string,
      userID?: string | null,
      drinkID?: number | null,
      createdAt?: string | null,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetCustomRecipeQueryVariables = {
  id: string,
};

export type GetCustomRecipeQuery = {
  getCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name: string,
    description?: string | null,
    ingredients?:  Array< {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } > | null,
    createdAt?: string | null,
    image?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListCustomRecipesQueryVariables = {
  filter?: ModelCustomRecipeFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListCustomRecipesQuery = {
  listCustomRecipes?:  {
    __typename: "ModelCustomRecipeConnection",
    items:  Array< {
      __typename: "CustomRecipe",
      id: string,
      name: string,
      description?: string | null,
      createdAt?: string | null,
      image?: string | null,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetUserProfileQueryVariables = {
  id: string,
};

export type GetUserProfileQuery = {
  getUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListUserProfilesQueryVariables = {
  filter?: ModelUserProfileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListUserProfilesQuery = {
  listUserProfiles?:  {
    __typename: "ModelUserProfileConnection",
    items:  Array< {
      __typename: "UserProfile",
      id: string,
      username?: string | null,
      bio?: string | null,
      role?: string | null,
      profilePicture?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type OnCreateGuestEventSubscriptionVariables = {
  filter?: ModelSubscriptionGuestEventFilterInput | null,
  owner?: string | null,
};

export type OnCreateGuestEventSubscription = {
  onCreateGuestEvent?:  {
    __typename: "GuestEvent",
    id: string,
    eventID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateGuestEventSubscriptionVariables = {
  filter?: ModelSubscriptionGuestEventFilterInput | null,
  owner?: string | null,
};

export type OnUpdateGuestEventSubscription = {
  onUpdateGuestEvent?:  {
    __typename: "GuestEvent",
    id: string,
    eventID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteGuestEventSubscriptionVariables = {
  filter?: ModelSubscriptionGuestEventFilterInput | null,
  owner?: string | null,
};

export type OnDeleteGuestEventSubscription = {
  onDeleteGuestEvent?:  {
    __typename: "GuestEvent",
    id: string,
    eventID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateEventSubscriptionVariables = {
  filter?: ModelSubscriptionEventFilterInput | null,
  owner?: string | null,
};

export type OnCreateEventSubscription = {
  onCreateEvent?:  {
    __typename: "Event",
    id: string,
    name: string,
    description?: string | null,
    location?: string | null,
    startTime: string,
    endTime: string,
    liquorbotId: number,
    inviteCode: string,
    drinkIDs?: Array< number > | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateEventSubscriptionVariables = {
  filter?: ModelSubscriptionEventFilterInput | null,
  owner?: string | null,
};

export type OnUpdateEventSubscription = {
  onUpdateEvent?:  {
    __typename: "Event",
    id: string,
    name: string,
    description?: string | null,
    location?: string | null,
    startTime: string,
    endTime: string,
    liquorbotId: number,
    inviteCode: string,
    drinkIDs?: Array< number > | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteEventSubscriptionVariables = {
  filter?: ModelSubscriptionEventFilterInput | null,
  owner?: string | null,
};

export type OnDeleteEventSubscription = {
  onDeleteEvent?:  {
    __typename: "Event",
    id: string,
    name: string,
    description?: string | null,
    location?: string | null,
    startTime: string,
    endTime: string,
    liquorbotId: number,
    inviteCode: string,
    drinkIDs?: Array< number > | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreatePouredDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionPouredDrinkFilterInput | null,
  owner?: string | null,
};

export type OnCreatePouredDrinkSubscription = {
  onCreatePouredDrink?:  {
    __typename: "PouredDrink",
    id: string,
    userID: string,
    drinkID: number,
    drinkName?: string | null,
    volume?: number | null,
    timestamp: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdatePouredDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionPouredDrinkFilterInput | null,
  owner?: string | null,
};

export type OnUpdatePouredDrinkSubscription = {
  onUpdatePouredDrink?:  {
    __typename: "PouredDrink",
    id: string,
    userID: string,
    drinkID: number,
    drinkName?: string | null,
    volume?: number | null,
    timestamp: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeletePouredDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionPouredDrinkFilterInput | null,
  owner?: string | null,
};

export type OnDeletePouredDrinkSubscription = {
  onDeletePouredDrink?:  {
    __typename: "PouredDrink",
    id: string,
    userID: string,
    drinkID: number,
    drinkName?: string | null,
    volume?: number | null,
    timestamp: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  owner?: string | null,
};

export type OnCreateLikedDrinkSubscription = {
  onCreateLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  owner?: string | null,
};

export type OnUpdateLikedDrinkSubscription = {
  onUpdateLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  owner?: string | null,
};

export type OnDeleteLikedDrinkSubscription = {
  onDeleteLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateCustomRecipeSubscriptionVariables = {
  filter?: ModelSubscriptionCustomRecipeFilterInput | null,
  owner?: string | null,
};

export type OnCreateCustomRecipeSubscription = {
  onCreateCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name: string,
    description?: string | null,
    ingredients?:  Array< {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } > | null,
    createdAt?: string | null,
    image?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateCustomRecipeSubscriptionVariables = {
  filter?: ModelSubscriptionCustomRecipeFilterInput | null,
  owner?: string | null,
};

export type OnUpdateCustomRecipeSubscription = {
  onUpdateCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name: string,
    description?: string | null,
    ingredients?:  Array< {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } > | null,
    createdAt?: string | null,
    image?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteCustomRecipeSubscriptionVariables = {
  filter?: ModelSubscriptionCustomRecipeFilterInput | null,
  owner?: string | null,
};

export type OnDeleteCustomRecipeSubscription = {
  onDeleteCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name: string,
    description?: string | null,
    ingredients?:  Array< {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } > | null,
    createdAt?: string | null,
    image?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
  owner?: string | null,
};

export type OnCreateUserProfileSubscription = {
  onCreateUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
  owner?: string | null,
};

export type OnUpdateUserProfileSubscription = {
  onUpdateUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
  owner?: string | null,
};

export type OnDeleteUserProfileSubscription = {
  onDeleteUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};
