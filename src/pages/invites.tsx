import { Link, Navigate, useParams } from "react-router-dom";
import { Button } from "../kit";
import { num, useApi, useAuth, userUrl, useTitle } from "../lib";
import { t } from "../i18n";
import { Async, Avatar, Empty, Section } from "../ui/base";
import { CopyField } from "../ui/copy-field";
import { oauthStart } from "../ui/oauth";
import { Username } from "../ui/username";
import { DISCORD_INVITE, type DiscordStatus } from "../../shared/discord";
import { INVITE_TIERS, LINKED_ROLE, type InviteBoard, type InviteFrom, type InviteLeader } from "../../shared/invites";

export function Invites() {
  const { me } = useAuth();
  const q = useApi<InviteBoard>("/invites");
  useTitle(t("user.invitesTitle"));
  return (
    <div className="wrap page">
      <h1 className="page-title">{t("user.invitesTitle")}</h1>
      <div className="narrow-col">
        <Async q={q}>
          {(d) => (
            <>
              <Section title={t("user.yourInviteLink")}>
                <p>{t("user.invitesIntro")}</p>
                {d.mine ? (
                  <YourInvites link={d.mine.link} invited={d.mine.invited} />
                ) : (
                  <p>
                    <Link to="/login?next=/invites">{t("user.logInForInvite")}</Link>
                  </p>
                )}
              </Section>
              {me && <DiscordRoles />}
              <Section title={t("user.topInviters")}>
                <Leaders items={d.items} />
              </Section>
            </>
          )}
        </Async>
      </div>
    </div>
  );
}

export function YourInvites({ link, invited }: { link: string; invited: number }) {
  return (
    <>
      <CopyField label={t("user.yourInviteLink")} value={link} />
      <p className="muted">
        {t("user.joinedFromLink")}: <b className="text-site-ink">{num(invited)}</b>
      </p>
    </>
  );
}

function DiscordRoles() {
  const q = useApi<DiscordStatus>("/discord");
  if (!q.data?.enabled) return null;
  const d = q.data;
  return (
    <Section title="Discord">
      <p>{t("user.inviteRoles")}</p>
      <ul className="m-0 mb-3 ps-5">
        <li>
          <b>{LINKED_ROLE}</b>: {t("user.linkedRole")}
        </li>
        {INVITE_TIERS.map((tier) => (
          <li key={tier.role}>
            <b>{tier.role}</b>: {t("user.inviteTier", { count: tier.invited })}
          </li>
        ))}
      </ul>
      {!d.linked ? (
        <Button kind="btn" href={oauthStart("discord", "link", "/invites")}>
          {t("settings.linkDiscord")}
        </Button>
      ) : (
        !d.inServer && (
          <Button kind="btn" href={DISCORD_INVITE}>
            {t("settings.joinDiscord")}
          </Button>
        )
      )}
    </Section>
  );
}

function Leaders({ items }: { items: InviteLeader[] }) {
  if (!items.length) return <Empty>{t("user.noInvitesYet")}</Empty>;
  return (
    <ol className="userlist">
      {items.map((u, i) => (
        <li key={u.id}>
          <b className="w-6 text-end text-site-muted">{i + 1}</b>
          <Avatar user={u} size={40} />
          <div className="grow">
            <Link className="strong" to={userUrl(u.username)}>
              <Username user={u} />
            </Link>
          </div>
          <b>{num(u.invited)}</b>
        </li>
      ))}
    </ol>
  );
}

export function InviteLanding() {
  const name = useParams().name!;
  const { me } = useAuth();
  const q = useApi<InviteFrom>(`/invites/${encodeURIComponent(name)}`);
  useTitle(t("user.invitedYou", { name }));
  if (me) return <Navigate to="/invites" replace />;
  return (
    <div className="wrap page">
      <div className="narrow-col flex flex-col items-center gap-4 text-center py-10">
        <Async q={q}>
          {(d) => (
            <>
              <Avatar user={d.inviter} size={88} />
              <h1 className="page-title m-0">{t("user.invitedYou", { name: d.inviter.username })}</h1>
              <p className="max-w-[460px]">{t("user.invitedYouBody")}</p>
              <Button kind="btn" href="/join">
                {t("common.join")}
              </Button>
            </>
          )}
        </Async>
      </div>
    </div>
  );
}
