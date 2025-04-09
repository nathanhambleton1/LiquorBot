/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateLikedDrinkInput = {
  id?: string | null,
  userID: string,
  drinkID: number,
};

export type ModelLikedDrinkConditionInput = {
  userID?: ModelStringInput | null,
  drinkID?: ModelIntInput | null,
  and?: Array< ModelLikedDrinkConditionInput | null > | null,
  or?: Array< ModelLikedDrinkConditionInput | null > | null,
  not?: ModelLikedDrinkConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
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

export type LikedDrink = {
  __typename: "LikedDrink",
  id: string,
  userID: string,
  drinkID: number,
  createdAt: string,
  updatedAt: string,
};

export type UpdateLikedDrinkInput = {
  id: string,
  userID?: string | null,
  drinkID?: number | null,
};

export type DeleteLikedDrinkInput = {
  id: string,
};

export type ModelLikedDrinkFilterInput = {
  id?: ModelIDInput | null,
  userID?: ModelStringInput | null,
  drinkID?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelLikedDrinkFilterInput | null > | null,
  or?: Array< ModelLikedDrinkFilterInput | null > | null,
  not?: ModelLikedDrinkFilterInput | null,
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

export type ModelLikedDrinkConnection = {
  __typename: "ModelLikedDrinkConnection",
  items:  Array<LikedDrink | null >,
  nextToken?: string | null,
};

export type ModelSubscriptionLikedDrinkFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  drinkID?: ModelSubscriptionIntInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionLikedDrinkFilterInput | null > | null,
  or?: Array< ModelSubscriptionLikedDrinkFilterInput | null > | null,
  userID?: ModelStringInput | null,
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

export type CreateLikedDrinkMutationVariables = {
  input: CreateLikedDrinkInput,
  condition?: ModelLikedDrinkConditionInput | null,
};

export type CreateLikedDrinkMutation = {
  createLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID: string,
    drinkID: number,
    createdAt: string,
    updatedAt: string,
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
    userID: string,
    drinkID: number,
    createdAt: string,
    updatedAt: string,
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
    userID: string,
    drinkID: number,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type GetLikedDrinkQueryVariables = {
  id: string,
};

export type GetLikedDrinkQuery = {
  getLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID: string,
    drinkID: number,
    createdAt: string,
    updatedAt: string,
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
      userID: string,
      drinkID: number,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type OnCreateLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  userID?: string | null,
};

export type OnCreateLikedDrinkSubscription = {
  onCreateLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID: string,
    drinkID: number,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  userID?: string | null,
};

export type OnUpdateLikedDrinkSubscription = {
  onUpdateLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID: string,
    drinkID: number,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  userID?: string | null,
};

export type OnDeleteLikedDrinkSubscription = {
  onDeleteLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID: string,
    drinkID: number,
    createdAt: string,
    updatedAt: string,
  } | null,
};
