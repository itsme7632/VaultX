import { createContext, useContext, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey, type UserProfile } from "@workspace/api-client-react";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  /** True while the session is being fetched or re-fetched (status not yet known). */
  isFetching: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isFetching: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isFetching } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 30000 },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isFetching,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
