import { LinkProvider } from "@astryxdesign/core/Link";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Ico } from "../src/icons";
import { RouteLink } from "../src/kit";
import { HomeHero } from "../src/pages/music/home-hero";
import { Logo } from "../src/ui/base";

export function guestHomeShell() {
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <LinkProvider component={RouteLink}>
        <header className="site-header guest-home-header">
          <div className="wrap">
            <a href="/" className="logo" aria-label="Sonosphere home">
              <Logo />
            </a>
            <nav className="site-nav" aria-label="Main">
              <a className="guest-search" href="/search" aria-label="Search">
                <Ico.Search />
              </a>
              <a href="/" className="active" aria-current="page">
                Home
              </a>
              <a href="/charts">Charts</a>
              <a href="/events">Events</a>
              <a href="/login">Log in</a>
              <a href="/join" className="join">
                Join
              </a>
            </nav>
          </div>
        </header>
        <main>
          <HomeHero />
        </main>
      </LinkProvider>
    </StaticRouter>
  );
}
