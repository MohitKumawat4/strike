import { AuthForm } from "../_components/auth-form";

export default async function SignupPage(props: PageProps<"/signup">) {
  const searchParams = await props.searchParams;
  const nextPath = typeof searchParams.next === "string" ? searchParams.next : undefined;

  return <AuthForm mode="signup" nextPath={nextPath} />;
}
