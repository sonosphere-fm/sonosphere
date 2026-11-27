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
  const q = useApi<InviteBoard>("/invites");
  useTitle(t("user.invitesTitle"));
  return (
    <div className="wrap page">
      <h1 className="page-title">{t("user.invitesTitle")}</h1>
      <Async q={q}>
        {(d) => (
          <div className="cols">
            <div className="main">
              <p className="invite-intro">{t("user.invitesIntro")}</p>
              {d.mine ? (
                <YourInvites link={d.mine.link} invited={d.mine.invited} />
              ) : (
                <Button kind="btn" href="/login?next=/invites">
                  {t("user.logInForInvite")}
                </Button>
              )}
              <Section title={t("user.topInviters")}>
                <Leaders items={d.items} />
              </Section>
            </div>
            <aside className="side">
              <DiscordRoles signedIn={!!d.mine} />
            </aside>
          </div>
        )}
      </Async>
    </div>
  );
}

export function YourInvites({ link, invited }: { link: string; invited: number }) {
  return (
    <div className="invite-link">
      <CopyField label={t("user.yourInviteLink")} value={link} />
      <div className="stat">
        <div className="stat-label">{t("user.joinedFromLink")}</div>
        <div className="stat-value">{num(invited)}</div>
      </div>
    </div>
  );
}

function DiscordRoles({ signedIn }: { signedIn: boolean }) {
  const q = useApi<DiscordStatus>("/discord");
  const d = q.data?.enabled ? q.data : null;
  return (
    <Section title="Discord">
      <p>{t("user.inviteRoles")}</p>
      <ul className="plain invite-roles">
        <Role role={LINKED_ROLE} need={t("user.linkedRole")} />
        {INVITE_TIERS.map((tier) => (
          <Role key={tier.role} role={tier} need={t("user.inviteTier", { count: tier.invited })} />
        ))}
      </ul>
      {signedIn && d && !d.linked && (
        <Button kind="btn" href={oauthStart("discord", "link", "/invites")}>
          {t("settings.linkDiscord")}
        </Button>
      )}
      {signedIn && d?.linked && !d.inServer && (
        <Button kind="btn" href={DISCORD_INVITE}>
          {t("settings.joinDiscord")}
        </Button>
      )}
    </Section>
  );
}

function Role({ role, need }: { role: { role: string; color: string }; need: string }) {
  return (
    <li>
      <i className="role-swatch" style={{ background: role.color }} />
      <b>{role.role}</b>
      <span className="muted">{need}</span>
    </li>
  );
}

function Leaders({ items }: { items: InviteLeader[] }) {
  if (!items.length) return <Empty>{t("user.noInvitesYet")}</Empty>;
  return (
    <ol className="userlist invite-leaders">
      {items.map((u, i) => (
        <li key={u.id}>
          <span className="rank">{i + 1}</span>
          <Avatar user={u} size={40} />
          <Link className="strong grow" to={userUrl(u.username)}>
            <Username user={u} />
          </Link>
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
      <Async q={q}>
        {(d) => (
          <div className="invite-landing">
            <Avatar user={d.inviter} size={88} />
            <h1 className="page-title">{t("user.invitedYou", { name: d.inviter.username })}</h1>
            <p>{t("user.invitedYouBody")}</p>
            <Button kind="btn" href="/join">
              {t("common.join")}
            </Button>
          </div>
        )}
      </Async>
    </div>
  );
}
