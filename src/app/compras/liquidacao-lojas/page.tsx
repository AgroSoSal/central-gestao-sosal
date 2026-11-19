import { StockView } from "../estoque-views"
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  return <StockView variant="lojas" searchParams={searchParams}/>
}
