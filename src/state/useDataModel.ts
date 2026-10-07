import { createContext, useContext, type Dispatch } from 'react'
import type { DataModelAction } from '../model/dataModelReducer'
import type { DataModelState } from '../model/types'

export interface DataModelContextValue {
  state: DataModelState
  dispatch: Dispatch<DataModelAction>
}

export const DataModelContext = createContext<DataModelContextValue | null>(null)

export function useDataModel(): DataModelContextValue {
  const value = useContext(DataModelContext)
  if (!value) throw new Error('useDataModel must be used inside DataModelProvider')
  return value
}
