import { useQuery } from "@tanstack/react-query";
import { metaApi } from "../api/endpoints";

export function useDepartments() {
  const { data } = useQuery({
    queryKey: ["meta", "departments"],
    queryFn: () => metaApi.departments(),
    staleTime: 5 * 60 * 1000,
  });
  return data?.data?.departments || [];
}

export function useCourses() {
  const { data } = useQuery({
    queryKey: ["meta", "courses"],
    queryFn: () => metaApi.courses(),
    staleTime: 5 * 60 * 1000,
  });
  return data?.data?.courses || [];
}
