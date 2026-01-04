import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <h1 className="text-6xl font-bold tracking-tight text-primary">404</h1>
      <p className="mt-4 text-xl font-semibold">Page Not Found</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Sorry, the page you’re looking for doesn’t exist or has been moved.
      </p>

      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Go Back Home
      </Link>
    </div>
  );
}
