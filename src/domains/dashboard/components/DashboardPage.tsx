import { Button } from "@/atomics/atoms/Button";
import { SectionHeading } from "@/atomics/molecules/SectionHeading";
import { MainLayout } from "@/atomics/templates/MainLayout";
import { useAppInfo } from "@/domains/dashboard/hooks/useAppInfo";

const workflow = [
  { number: "01", title: "거래내역 모으기", description: "통장의 입출금 기록을 월별 장부로 정리합니다." },
  { number: "02", title: "지출 채우기", description: "통장에 없는 지출을 더하고 항목을 분류합니다." },
  { number: "03", title: "한 달 정산하기", description: "수입과 지출을 확인하고 배분할 금액을 정합니다." },
];

export function DashboardPage() {
  const { data, isPending, isError, refetch } = useAppInfo();
  return (
    <MainLayout footer={data ? `차곡 v${data.version}` : "차곡"}>
      <p className="mb-4 text-xs font-semibold tracking-widest text-primary">기록에서 정산까지</p>
      <h1 className="max-w-xl text-4xl leading-snug font-semibold tracking-tight">
        차곡차곡 모아서,
        <br />한 달을 정리하세요.
      </h1>
      <p className="mt-5 max-w-lg text-base leading-7 text-muted">
        흩어진 수입과 지출을 한곳에 모으는 운영 장부입니다.
      </p>
      <div className="mt-12 grid gap-8 border-y border-line py-9 md:grid-cols-3">
        {workflow.map(item => (
          <section key={item.number}>
            <span className="text-xs font-medium text-primary">{item.number}</span>
            <h2 className="mt-3 text-base font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
          </section>
        ))}
      </div>
      <section
        className="mt-10"
        aria-live="polite"
      >
        <SectionHeading
          title="앱 연결 상태"
          description={
            isPending
              ? "앱 정보를 확인하고 있습니다."
              : isError
                ? "앱 정보를 불러오지 못했습니다."
                : `${data?.name} v${data?.version} · ${data?.platform}`
          }
          action={
            <Button
              disabled={isPending}
              onClick={() => void refetch()}
            >
              다시 확인
            </Button>
          }
        />
      </section>
    </MainLayout>
  );
}
