import { AuthForm } from "../_components/auth-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const nextPath = typeof searchParams.next === "string" ? searchParams.next : undefined;
  const initialError = typeof searchParams.error === "string" ? searchParams.error : undefined;

  return <AuthForm initialError={initialError} mode="login" nextPath={nextPath} />;
}
