import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let alice: string;
let bob: string;
let admin: string;
let aliceRequest: string;

const requestColumns = `client_id, full_name, email, education_status, challenge, goals, questions,
  expected_outcomes, preferred_format, consent_privacy`;

function requestValues(clientId: string) {
  return [
    clientId,
    "Test Client",
    "client@example.test",
    "Final-year undergraduate",
    "I am unsure whether to pursue a master's degree or start working right away.",
    "Choose a clear direction",
    "Which path fits my goals?",
    "A written action plan",
    "video",
    true,
  ];
}

async function insertRequestAs(userId: string, clientId = userId) {
  return t.as("authenticated", userId, async (q) => {
    const res = await q<{ id: string; reference_code: string; status: string }>(
      `insert into public.consultation_requests (${requestColumns})
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, reference_code, status`,
      requestValues(clientId),
    );
    return res.rows[0];
  });
}

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("alice@example.test");
  bob = await t.createUser("bob@example.test");
  admin = await t.createUser("consultant@example.test", { admin: true });
  aliceRequest = (await insertRequestAs(alice)).id;
});

describe("identity and roles", () => {
  it("creates a profile and client role for new users", async () => {
    const rows = await t.as("authenticated", alice, (q) =>
      q<{ role: string }>("select role from public.user_roles where user_id = $1", [alice]),
    );
    expect(rows.rows.map((r) => r.role)).toEqual(["client"]);
    const profile = await t.as("authenticated", alice, (q) =>
      q("select email from public.profiles where id = $1", [alice]),
    );
    expect(profile.rows).toHaveLength(1);
  });

  it("does not let a client grant themselves the admin role", async () => {
    await expect(
      t.as("authenticated", alice, (q) =>
        q("insert into public.user_roles (user_id, role) values ($1, 'admin')", [alice]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.as("authenticated", alice, (q) => q("select public.grant_admin('alice@example.test')")),
    ).rejects.toThrow(/permission denied/);
  });

  it("reports admin status correctly", async () => {
    const a = await t.as("authenticated", admin, (q) => q<{ is_admin: boolean }>("select public.is_admin()"));
    const c = await t.as("authenticated", alice, (q) => q<{ is_admin: boolean }>("select public.is_admin()"));
    expect(a.rows[0].is_admin).toBe(true);
    expect(c.rows[0].is_admin).toBe(false);
  });

  it("prevents clients from reading other profiles", async () => {
    const res = await t.as("authenticated", alice, (q) => q("select id from public.profiles"));
    expect(res.rows).toHaveLength(1);
  });
});

describe("consultation requests", () => {
  it("generates a reference code and records initial status history", async () => {
    const created = await insertRequestAs(bob);
    expect(created.reference_code).toMatch(/^CR-\d{4}-[A-Z2-9]{6}$/);
    expect(created.status).toBe("submitted");
    const history = await t.as("authenticated", bob, (q) =>
      q("select to_status from public.request_status_history where request_id = $1", [created.id]),
    );
    expect(history.rows).toEqual([{ to_status: "submitted" }]);
  });

  it("rejects requests created on behalf of another user", async () => {
    await expect(insertRequestAs(alice, bob)).rejects.toThrow(/row-level security/);
  });

  it("does not allow a client to choose the status", async () => {
    await expect(
      t.as("authenticated", alice, (q) =>
        q(
          `insert into public.consultation_requests (${requestColumns}, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'accepted')`,
          requestValues(alice),
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("isolates requests between clients and lets the admin see all", async () => {
    const bobSees = await t.as("authenticated", bob, (q) =>
      q("select id from public.consultation_requests where id = $1", [aliceRequest]),
    );
    expect(bobSees.rows).toHaveLength(0);
    const adminSees = await t.as("authenticated", admin, (q) =>
      q("select id from public.consultation_requests where id = $1", [aliceRequest]),
    );
    expect(adminSees.rows).toHaveLength(1);
    const anonSees = await t.as("anon", null, (q) =>
      q("select id from public.consultation_requests").catch((e: Error) => ({ rows: [], error: e.message })),
    );
    expect(anonSees.rows).toHaveLength(0);
  });

  it("does not let a client change the status of their own request", async () => {
    const res = await t.as("authenticated", alice, (q) =>
      q("update public.consultation_requests set status = 'accepted' where id = $1", [aliceRequest]),
    );
    expect(res.affectedRows).toBe(0);
  });

  it("records admin status changes with the client message", async () => {
    await t.as("authenticated", admin, (q) =>
      q(
        "update public.consultation_requests set status = 'more_info_required', client_message = 'Please share your transcript' where id = $1",
        [aliceRequest],
      ),
    );
    const history = await t.as("authenticated", alice, (q) =>
      q<{ to_status: string; client_message: string; changed_by: string }>(
        "select to_status, client_message, changed_by from public.request_status_history where request_id = $1 order by id",
        [aliceRequest],
      ),
    );
    expect(history.rows.at(-1)).toMatchObject({
      to_status: "more_info_required",
      client_message: "Please share your transcript",
      changed_by: admin,
    });
  });

  it("keeps administrator notes private", async () => {
    await t.as("authenticated", admin, (q) =>
      q("insert into public.admin_notes (request_id, author_id, body) values ($1, $2, 'private note')", [
        aliceRequest,
        admin,
      ]),
    );
    const clientView = await t.as("authenticated", alice, (q) => q("select * from public.admin_notes"));
    expect(clientView.rows).toHaveLength(0);
    await expect(
      t.as("authenticated", alice, (q) =>
        q("insert into public.admin_notes (request_id, author_id, body) values ($1, $2, 'x')", [aliceRequest, alice]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("only lets clients post messages on their own requests as a client", async () => {
    await t.as("authenticated", alice, (q) =>
      q("insert into public.request_messages (request_id, author_id, author_role, body) values ($1,$2,'client','Here it is')", [
        aliceRequest,
        alice,
      ]),
    );
    await expect(
      t.as("authenticated", bob, (q) =>
        q("insert into public.request_messages (request_id, author_id, author_role, body) values ($1,$2,'client','hi')", [
          aliceRequest,
          bob,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      t.as("authenticated", alice, (q) =>
        q("insert into public.request_messages (request_id, author_id, author_role, body) values ($1,$2,'admin','spoof')", [
          aliceRequest,
          alice,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("appointments", () => {
  async function book(requestId: string, clientId: string, start: string, end: string, buffer = 15) {
    return t.as("service_role", null, (q) =>
      q<{ id: string }>(
        `insert into public.appointments (request_id, client_id, starts_at, ends_at, buffer_minutes, format, status)
         values ($1,$2,$3,$4,$5,'video','pending') returning id`,
        [requestId, clientId, start, end, buffer],
      ),
    );
  }

  it("prevents overlapping bookings including buffers", async () => {
    const r1 = (await insertRequestAs(alice)).id;
    const r2 = (await insertRequestAs(bob)).id;
    await book(r1, alice, "2030-01-07T05:00:00Z", "2030-01-07T06:00:00Z");
    // Starts 10 minutes after the first ends, inside the 15 minute buffer.
    await expect(book(r2, bob, "2030-01-07T06:10:00Z", "2030-01-07T07:10:00Z")).rejects.toMatchObject({
      code: "23P01",
    });
    // Outside the buffers it is fine.
    await expect(book(r2, bob, "2030-01-07T06:30:00Z", "2030-01-07T07:30:00Z")).resolves.toBeDefined();
  });

  it("frees the slot when an appointment is cancelled", async () => {
    const r1 = (await insertRequestAs(alice)).id;
    const r2 = (await insertRequestAs(bob)).id;
    const first = await book(r1, alice, "2030-02-01T05:00:00Z", "2030-02-01T06:00:00Z");
    await t.as("service_role", null, (q) =>
      q("update public.appointments set status = 'cancelled' where id = $1", [first.rows[0].id]),
    );
    await expect(book(r2, bob, "2030-02-01T05:00:00Z", "2030-02-01T06:00:00Z")).resolves.toBeDefined();
  });

  it("allows only one active appointment per request", async () => {
    const r1 = (await insertRequestAs(alice)).id;
    await book(r1, alice, "2030-03-01T05:00:00Z", "2030-03-01T06:00:00Z");
    await expect(book(r1, alice, "2030-03-02T05:00:00Z", "2030-03-02T06:00:00Z")).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("hides other clients' appointments and blocks direct client writes", async () => {
    const own = await t.as("authenticated", bob, (q) =>
      q<{ client_id: string }>("select client_id from public.appointments"),
    );
    expect(own.rows.every((r) => r.client_id === bob)).toBe(true);
    const r = (await insertRequestAs(alice)).id;
    await expect(
      t.as("authenticated", alice, (q) =>
        q(
          `insert into public.appointments (request_id, client_id, starts_at, ends_at, format)
           values ($1,$2,'2030-04-01T05:00:00Z','2030-04-01T06:00:00Z','video')`,
          [r, alice],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("consultation outcomes", () => {
  async function createOutcome(clientId: string, requestId: string) {
    return t.as("authenticated", admin, async (q) => {
      const o = await q<{ id: string }>(
        "insert into public.consultation_outcomes (request_id, client_id, title, created_by) values ($1,$2,'Career plan',$3) returning id",
        [requestId, clientId, admin],
      );
      const v = await q<{ id: string }>(
        `insert into public.outcome_versions (outcome_id, version_number, content, source, created_by)
         values ($1, 1, '{"overview":"v1"}', 'ai_draft', $2) returning id`,
        [o.rows[0].id, admin],
      );
      return { outcomeId: o.rows[0].id, versionId: v.rows[0].id };
    });
  }

  it("never exposes draft content to the client", async () => {
    const { outcomeId } = await createOutcome(alice, aliceRequest);
    const versions = await t.as("authenticated", alice, (q) =>
      q("select * from public.outcome_versions where outcome_id = $1", [outcomeId]),
    );
    expect(versions.rows).toHaveLength(0);
    const status = await t.as("authenticated", alice, (q) =>
      q<{ status: string }>("select status from public.consultation_outcomes where id = $1", [outcomeId]),
    );
    expect(status.rows[0].status).toBe("draft");
  });

  it("refuses to publish without approval", async () => {
    const { outcomeId, versionId } = await createOutcome(alice, aliceRequest);
    await expect(
      t.as("authenticated", admin, (q) => q("select public.publish_outcome($1)", [outcomeId])),
    ).rejects.toThrow(/Only approved outcomes/);
    await expect(
      t.as("authenticated", admin, (q) =>
        q("update public.consultation_outcomes set status = 'published', published_version_id = $2 where id = $1", [
          outcomeId,
          versionId,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("does not let clients approve or publish", async () => {
    const { outcomeId, versionId } = await createOutcome(alice, aliceRequest);
    await expect(
      t.as("authenticated", alice, (q) => q("select public.approve_outcome($1, $2)", [outcomeId, versionId])),
    ).rejects.toThrow(/permission denied|Not authorized/);
    await expect(
      t.as("authenticated", alice, (q) => q("select public.publish_outcome($1)", [outcomeId])),
    ).rejects.toThrow(/permission denied|Not authorized/);
  });

  it("invalidates approval when a new version is added", async () => {
    const { outcomeId, versionId } = await createOutcome(alice, aliceRequest);
    await t.as("authenticated", admin, (q) => q("select public.approve_outcome($1, $2)", [outcomeId, versionId]));
    await t.as("authenticated", admin, (q) =>
      q(
        `insert into public.outcome_versions (outcome_id, version_number, content, created_by)
         values ($1, 2, '{"overview":"v2"}', $2)`,
        [outcomeId, admin],
      ),
    );
    const row = await t.as("authenticated", admin, (q) =>
      q<{ status: string; approved_by: string | null }>(
        "select status, approved_by from public.consultation_outcomes where id = $1",
        [outcomeId],
      ),
    );
    expect(row.rows[0]).toEqual({ status: "draft", approved_by: null });
  });

  it("publishes the approved version, shows only it to the owner and supersedes earlier outcomes", async () => {
    const first = await createOutcome(alice, aliceRequest);
    await t.as("authenticated", admin, async (q) => {
      await q("select public.approve_outcome($1, $2)", [first.outcomeId, first.versionId]);
      await q("select public.publish_outcome($1)", [first.outcomeId]);
    });

    const visible = await t.as("authenticated", alice, (q) =>
      q<{ id: string }>("select id from public.outcome_versions where outcome_id = $1", [first.outcomeId]),
    );
    expect(visible.rows.map((r) => r.id)).toEqual([first.versionId]);

    const bobView = await t.as("authenticated", bob, (q) =>
      q("select id from public.outcome_versions where outcome_id = $1", [first.outcomeId]),
    );
    expect(bobView.rows).toHaveLength(0);

    await expect(
      t.as("authenticated", admin, (q) =>
        q(
          `insert into public.outcome_versions (outcome_id, version_number, content, created_by)
           values ($1, 2, '{"overview":"changed"}', $2)`,
          [first.outcomeId, admin],
        ),
      ),
    ).rejects.toThrow(/Cannot add versions to a published outcome/);

    const second = await createOutcome(alice, aliceRequest);
    await t.as("authenticated", admin, async (q) => {
      await q("select public.approve_outcome($1, $2)", [second.outcomeId, second.versionId]);
      await q("select public.publish_outcome($1)", [second.outcomeId]);
    });
    const firstAfter = await t.as("authenticated", admin, (q) =>
      q<{ status: string; superseded_by: string }>(
        "select status, superseded_by from public.consultation_outcomes where id = $1",
        [first.outcomeId],
      ),
    );
    expect(firstAfter.rows[0]).toEqual({ status: "superseded", superseded_by: second.outcomeId });

    const audit = await t.as("authenticated", admin, (q) =>
      q<{ action: string }>("select action from public.audit_logs where entity_id = $1 order by id", [first.outcomeId]),
    );
    expect(audit.rows.map((r) => r.action)).toEqual(["outcome.approved", "outcome.published", "outcome.superseded"]);
  });

  it("keeps versions immutable", async () => {
    const { versionId } = await createOutcome(alice, aliceRequest);
    await expect(
      t.as("authenticated", admin, (q) =>
        q(`update public.outcome_versions set content = '{"overview":"tampered"}' where id = $1`, [versionId]),
      ),
    ).rejects.toThrow(/immutable/);
  });
});

describe("content and AI records", () => {
  it("hides draft blog posts from the public", async () => {
    await t.as("authenticated", admin, (q) =>
      q(`insert into public.blog_posts (slug, title, status) values ('draft-post', 'Draft post', 'draft')`),
    );
    await expect(
      t.as("authenticated", admin, (q) =>
        q(`insert into public.blog_posts (slug, title, status) values ('no-date', 'No date', 'published')`),
      ),
    ).rejects.toThrow(/check constraint/);
    await t.as("authenticated", admin, (q) =>
      q(`insert into public.blog_posts (slug, title, status, published_at) values ('live-post-2', 'Live post', 'published', now() - interval '1 minute')`),
    );
    const anon = await t.as("anon", null, (q) => q<{ slug: string }>("select slug from public.blog_posts"));
    expect(anon.rows.map((r) => r.slug)).toEqual(["live-post-2"]);
  });

  it("keeps AI analyses and usage admin-only", async () => {
    const run = await t.as("service_role", null, (q) =>
      q<{ id: string }>("insert into public.ai_runs (feature, model, status) values ('intake_analysis','test-model','succeeded') returning id"),
    );
    await t.as("service_role", null, (q) =>
      q("insert into public.ai_generations (feature, ai_run_id, request_id, content) values ('intake_analysis', $1, $2, '{}')", [
        run.rows[0].id,
        aliceRequest,
      ]),
    );
    const clientGen = await t.as("authenticated", alice, (q) => q("select * from public.ai_generations"));
    const clientRuns = await t.as("authenticated", alice, (q) => q("select * from public.ai_runs"));
    expect(clientGen.rows).toHaveLength(0);
    expect(clientRuns.rows).toHaveLength(0);
    const adminGen = await t.as("authenticated", admin, (q) => q("select * from public.ai_generations"));
    expect(adminGen.rows.length).toBeGreaterThan(0);
  });

  it("keeps assistant conversations private to their owner", async () => {
    const convo = await t.as("authenticated", alice, (q) =>
      q<{ id: string }>("insert into public.ai_conversations (user_id) values ($1) returning id", [alice]),
    );
    const bobView = await t.as("authenticated", bob, (q) =>
      q("select * from public.ai_conversations where id = $1", [convo.rows[0].id]),
    );
    expect(bobView.rows).toHaveLength(0);
    await expect(
      t.as("authenticated", bob, (q) => q("insert into public.ai_conversations (user_id) values ($1)", [alice])),
    ).rejects.toThrow(/row-level security/);
  });

  it("keeps settings and audit logs away from clients", async () => {
    const settings = await t.as("authenticated", alice, (q) => q("select * from public.app_settings"));
    expect(settings.rows).toHaveLength(0);
    const audit = await t.as("authenticated", alice, (q) => q("select * from public.audit_logs"));
    expect(audit.rows).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await t.as("service_role", null, (q) =>
        q<{ allowed: boolean }>("select public.consume_rate_limit('test:key', 3, 3600) as allowed"),
      );
      results.push(r.rows[0].allowed);
    }
    expect(results).toEqual([true, true, true, false]);
  });

  it("is not callable by clients", async () => {
    await expect(
      t.as("authenticated", alice, (q) => q("select public.consume_rate_limit('x', 1, 60)")),
    ).rejects.toThrow(/permission denied/);
  });
});
