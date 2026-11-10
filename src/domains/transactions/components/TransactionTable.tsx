import { ChevronLeft, ChevronRight, FileSpreadsheet, Upload } from "lucide-react";
import { Badge } from "@/atomics/atoms/badge";
import { Button } from "@/atomics/atoms/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/atomics/atoms/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/atomics/atoms/empty";
import { Input } from "@/atomics/atoms/input";
import { NativeSelect, NativeSelectOption } from "@/atomics/atoms/native-select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/atomics/atoms/table";
import type { TransactionFilter, TransactionList, TransactionQuery } from "@/shared/desktop/transactions";
import { formatMoney } from "@/shared/utils/money";

interface Props {
  data: TransactionList;
  query: TransactionQuery;
  onSearch: (value: string) => void;
  onFilter: (value: TransactionFilter) => void;
  onPage: (value: number) => void;
  onImport: () => void;
  onDetail: (id: string) => void;
  importing: boolean;
  loading: boolean;
}

export function TransactionTable({
  data,
  query,
  onSearch,
  onFilter,
  onPage,
  onImport,
  onDetail,
  importing,
  loading,
}: Props) {
  return (
    <Card className="min-h-96 flex-1">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardTitle>거래내역</CardTitle>
          <Badge variant="secondary">{data.total.toLocaleString()}건</Badge>
        </div>
        <div className="flex gap-2">
          <Input
            aria-label="거래 내용 검색"
            placeholder="내용·메모·계좌 검색"
            maxLength={120}
            value={query.search}
            onChange={event => onSearch(event.target.value)}
            className="w-48"
          />
          <NativeSelect
            aria-label="거래 필터"
            value={query.filter}
            onChange={event => onFilter(event.target.value as TransactionFilter)}
          >
            <NativeSelectOption value="all">전체 거래</NativeSelectOption>
            <NativeSelectOption value="deposit">입금</NativeSelectOption>
            <NativeSelectOption value="withdrawal">출금</NativeSelectOption>
            <NativeSelectOption value="review">확인 필요</NativeSelectOption>
          </NativeSelect>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>거래일시</TableHead>
              <TableHead>거래 내용</TableHead>
              <TableHead>계좌</TableHead>
              <TableHead className="text-right">출금</TableHead>
              <TableHead className="text-right">입금</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(loading ? [] : data.rows).map(row => (
              <TableRow key={row.id}>
                <TableCell>
                  <div>{row.occurredAt.slice(0, 10)}</div>
                  <div className="text-xs text-muted-foreground">{row.occurredAt.slice(11)}</div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    className="h-auto max-w-52 justify-start truncate p-0"
                    onClick={() => onDetail(row.id)}
                    aria-label={`거래 상세: ${row.description || row.occurredAt}`}
                  >
                    {row.description || "내용 없음"}
                  </Button>
                  {row.counterparty && (
                    <div className="max-w-52 truncate text-xs text-muted-foreground">{row.counterparty}</div>
                  )}
                </TableCell>
                <TableCell className="max-w-32 truncate">{row.accountName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(row.withdrawal)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(row.deposit)}</TableCell>
                <TableCell>
                  <Badge variant={row.issues.length ? "destructive" : "outline"}>
                    {row.issues.length ? "확인 필요" : "미분류"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {loading && (
          <p
            role="status"
            className="p-6 text-sm text-muted-foreground"
          >
            거래내역 불러오는 중…
          </p>
        )}
        {!loading && !data.rows.length && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSpreadsheet />
              </EmptyMedia>
              <EmptyTitle>
                {data.summary.count ? "조건에 맞는 거래가 없습니다" : "이 달의 거래내역이 없습니다"}
              </EmptyTitle>
              <EmptyDescription>
                {data.summary.count
                  ? "검색어나 거래 필터를 변경해 주세요."
                  : "은행에서 내려받은 엑셀 파일을 가져오세요."}
              </EmptyDescription>
            </EmptyHeader>
            {!data.summary.count && (
              <EmptyContent>
                <Button
                  onClick={onImport}
                  disabled={importing}
                >
                  <Upload />
                  거래내역 가져오기
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          거래 출처 {data.summary.importCount}개 · 통장 거래 {data.summary.count.toLocaleString()}건
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {query.page + 1} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="이전 페이지"
            disabled={loading || query.page === 0}
            onClick={() => onPage(query.page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="다음 페이지"
            disabled={loading || (query.page + 1) * data.pageSize >= data.total}
            onClick={() => onPage(query.page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
