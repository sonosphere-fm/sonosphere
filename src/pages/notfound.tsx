import { Link } from "react-router-dom";
import { TITLES, useTitle } from "../lib";
import { Empty } from "../ui/base";

export function NotFound() {
  useTitle(TITLES.notFound);
  return (
    <div className="wrap page">
      <Empty>
        <strong>Page not found.</strong> Try the <Link to="/charts">charts</Link> or search for something.
      </Empty>
    </div>
  );
}
