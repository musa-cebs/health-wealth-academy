export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2>Open the Academy from Vendor AI</h2>
      <p className="muted">Sign in once in Vendor AI, then choose <b>Training</b> from the menu. You will arrive here already signed in.</p>
      {error && <div className="err">That sign-in link has expired or is not valid. Please go back to Vendor AI and choose Training again.</div>}
    </div>
  );
}
