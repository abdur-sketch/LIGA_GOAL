import { FixtureDetail } from "@/components/admin/fixture-detail";
export default async function FixtureDetailPage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <FixtureDetail id={id}/>;}
