import { Link } from "react-router-dom";
import { useTitle } from "../lib";
import { Empty } from "../ui/base";

export function NotFound() {
  useTitle("Not found");
  return (
    <div className="wrap page">
      <Empty>
        <strong>Page not found.</strong> Try the <Link to="/charts">charts</Link> or search for something.
      </Empty>
    </div>
  );
}
