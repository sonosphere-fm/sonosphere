import { expect, mock, test } from "bun:test";
import { load } from "cheerio";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../lib";
import { PlayerProvider } from "../player";
import { TrackList } from "./lists";
import { ScrobbleMenu } from "./scrobble-menu";
import type { Me } from "../../shared/auth";
import type { RecentTrack } from "../../shared/listening";

const row: RecentTrack = {
  id: 123,
  playedAt: 1700000000,
  trackId: 456,
  title: "First track",
  duration: 180,
  artist: "Artist",
  album: "Album",
  image: null,
  user: "owner",
  userImage: null,
  loved: 0,
};

function render(children: ReactNode, username: string | null = "owner") {
  const me = username === null ? null : ({ username } as Me);
  return load(
    renderToStaticMarkup(
      <AuthContext.Provider value={{ me, setMe: () => {}, refresh: () => {} }}>
        <MemoryRouter>
          <PlayerProvider>{children}</PlayerProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    )
  );
}

test.each([
  { username: "owner", expected: 1 },
  { username: "another-user", expected: 0 },
  { username: null, expected: 0 },
])("enforces scrobble-menu ownership for %j", ({ username, expected }) => {
  const $ = render(<ScrobbleMenu row={row} />, username);
  expect($(".scrobble-menu-trigger").length).toBe(expected);
  expect($("[data-scrobble-context-trigger]").length).toBe(expected);
});

test("puts the menu after the timestamp without adding an action column", () => {
  const $ = render(<TrackList items={[row]} time timeActions={(r) => <ScrobbleMenu row={r} />} />);
  const tail = $("td.c-time .track-tail");
  expect(tail.children().first().hasClass("track-time")).toBe(true);
  expect(tail.children().last().hasClass("track-time-actions")).toBe(true);
  expect(tail.find(".scrobble-menu-trigger").attr("aria-haspopup")).toBe("menu");
  expect(tail.find(".scrobble-menu-trigger").attr("aria-expanded")).toBe("false");
  expect(tail.find("[data-scrobble-context-trigger]").length).toBe(1);
  expect($("td.c-actions").length).toBe(0);
});

test("never offers history actions for the now-playing row", () => {
  const actions = mock((r: RecentTrack) => <ScrobbleMenu row={r} />);
  const $ = render(
    <TrackList items={[row]} time nowPlaying={{ title: "Live track", artist: "Artist" }} timeActions={actions} />
  );
  expect(actions).toHaveBeenCalledTimes(1);
  expect(actions).toHaveBeenCalledWith(row);
  expect($("tr.now .track-time-actions").length).toBe(0);
  expect($("tr.now").text()).toContain("Scrobbling now");
});

test("preserves the separate column for bulk-selection controls", () => {
  const $ = render(
    <TrackList items={[row]} time actions={() => <input type="checkbox" aria-label="Select track" />} />
  );
  expect($("td.c-actions input[type=checkbox]").length).toBe(1);
  expect($("td.c-time .track-time-actions").length).toBe(0);
});

test("row selection intercepts body and link clicks but leaves controls and now-playing alone", () => {
  const select = mock();
  const table = TrackList({
    items: [row],
    nowPlaying: { title: "Live track", artist: "Artist" },
    onSelect: select,
  });
  const [now, history] = table.props.children[1].props.children;
  expect(now.props.onClickCapture).toBeUndefined();
  expect(history.props.className).toBe("selectable");

  const preventDefault = mock();
  const stopPropagation = mock();
  const event = { button: 0, target: { closest: () => null }, preventDefault, stopPropagation };
  history.props.onClickCapture(event);
  expect(select).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledWith(row);
  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(stopPropagation).toHaveBeenCalledTimes(1);

  history.props.onMouseDownCapture({ ...event, target: { closest: () => ({}) } });
  expect(preventDefault).toHaveBeenCalledTimes(2);
  history.props.onClickCapture({ ...event, target: { closest: () => ({}) } });
  expect(select).toHaveBeenCalledTimes(1);
});

test("does not call timestamp actions in untimed track lists", () => {
  const actions = mock((r: RecentTrack) => <ScrobbleMenu row={r} />);
  const $ = render(<TrackList items={[row]} timeActions={actions} />);
  expect(actions).not.toHaveBeenCalled();
  expect($(".scrobble-menu-trigger").length).toBe(0);
});
