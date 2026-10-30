import AuthenticatedWorkspace from "@/components/atlas/authenticated-workspace";
export const dynamic = "force-dynamic";
export default function AdministrationPage() { return <AuthenticatedWorkspace initialPage="admin" />; }
