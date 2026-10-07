import { useReducer, type ReactNode } from 'react'
import { dataModelReducer } from '../model/dataModelReducer'
import { createSeedState } from '../model/seed'
import type { DataModelState } from '../model/types'
import { DataModelContext } from './useDataModel'

export function DataModelProvider({ children, initialState }: { children: ReactNode; initialState?: DataModelState }) {
  const [state, dispatch] = useReducer(dataModelReducer, initialState ?? null, (init) => init ?? createSeedState())
  return <DataModelContext.Provider value={{ state, dispatch }}>{children}</DataModelContext.Provider>
}
