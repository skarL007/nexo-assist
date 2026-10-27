import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./store";

// Versões tipadas dos hooks do react-redux.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
