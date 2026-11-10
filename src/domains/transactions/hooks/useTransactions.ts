import { useEffect, useMemo, useState } from "react";
import type { TransactionFilter, TransactionList, TransactionQuery } from "@/shared/desktop/transactions";

export function useTransactions(month: string, revision: number) {
  const [filters, setFilters] = useState<TransactionQuery>({ month, search: "", filter: "all", page: 0 });
  const query = useMemo<TransactionQuery>(
    () => (filters.month === month ? filters : { month, search: "", filter: "all", page: 0 }),
    [filters, month],
  );
  const key = JSON.stringify(query);
  const [state, setState] = useState<{
    key: string;
    month: string;
    loading: boolean;
    data: TransactionList | null;
    error: string | null;
  }>({
    key: "",
    month: "",
    loading: true,
    data: null,
    error: null,
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState(previous => ({
      key,
      month: query.month,
      loading: true,
      data: previous.month === query.month ? previous.data : null,
      error: null,
    }));
    void window.chagok
      .listTransactions(query)
      .then(data => {
        if (active) setState({ key, month: query.month, loading: false, data, error: null });
      })
      .catch(() => {
        if (active)
          setState({
            key,
            month: query.month,
            loading: false,
            data: null,
            error: "거래내역을 불러오지 못했습니다.",
          });
      });
    return () => {
      active = false;
    };
  }, [key, query, revision, retry]);
  return {
    data: state.month === month ? state.data : null,
    loading: state.key !== key || state.loading,
    error: state.key === key ? state.error : null,
    query,
    setSearch: (search: string) => setFilters({ ...query, search, page: 0 }),
    setFilter: (filter: TransactionFilter) => setFilters({ ...query, filter, page: 0 }),
    setPage: (page: number) => setFilters({ ...query, page }),
    reload: () => setRetry(value => value + 1),
  };
}
