import { useState } from "react";
import { HeartHandshake, Loader2, Send, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

const INTERESTS = [
  "Prayer",
  "Encouragement",
  "Leadership support",
  "Getting connected",
  "Making WholeLife my home",
] as const;
type Interest = (typeof INTERESTS)[number];

const empty = {
  name: "",
  email: "",
  phone: "",
  firstTime: false,
  interests: [] as Interest[],
  prayerRequest: "",
  followUpOk: true,
  website: "",
};

function initialForm() {
  try {
    const want = new URLSearchParams(window.location.search).get("interest");
    if (want === "home")
      return { ...empty, interests: ["Making WholeLife my home"] as Interest[] };
  } catch {
    /* ignore */
  }
  return empty;
}

export default function ConnectionCardForm() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const submit = trpc.connect.submit.useMutation({
    onSuccess: () => {
      setForm(empty);
      setError("");
    },
    onError: e => setError(e.message),
  });
  const set = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) =>
    setForm(f => ({ ...f, [key]: value }));
  const toggle = (interest: Interest) =>
    set(
      "interests",
      form.interests.includes(interest)
        ? form.interests.filter(i => i !== interest)
        : [...form.interests, interest]
    );

  if (submit.isSuccess)
    return (
      <section className="connection-card no-print" id="connect">
        <div className="connection-done">
          <span className="connection-icon">
            <Check size={22} />
          </span>
          <h2>Thank you. We'll be in touch.</h2>
          <p>
            Your card went to our pastoral team. We're glad you're here.
          </p>
          <button className="button secondary" onClick={() => submit.reset()}>
            Fill out another card
          </button>
        </div>
      </section>
    );

  return (
    <section className="connection-card no-print" id="connect">
      <div className="connection-heading">
        <span className="connection-icon">
          <HeartHandshake size={22} />
        </span>
        <div>
          <span className="eyebrow">LET'S STAY CONNECTED</span>
          <h2>Connection Card</h2>
          <p>
            Seeking prayer, encouragement, leadership support, or simply
            looking to get connected? We're here for you.
          </p>
        </div>
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (!form.email.trim() && !form.phone.trim()) {
            setError("Please share an email or phone number so we can reach you.");
            return;
          }
          submit.mutate({
            ...form,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            prayerRequest: form.prayerRequest.trim(),
            followUpOk: form.email.trim() ? form.followUpOk : false,
          });
        }}
      >
        <label>
          Your name
          <input
            value={form.name}
            onChange={e => set("name", e.target.value)}
            maxLength={120}
            autoComplete="name"
            required
          />
        </label>
        <div className="connection-row">
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              maxLength={254}
              autoComplete="email"
              inputMode="email"
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={e => set("phone", e.target.value)}
              maxLength={40}
              autoComplete="tel"
              inputMode="tel"
            />
          </label>
        </div>
        <label className="check-line big">
          <input
            type="checkbox"
            checked={form.firstTime}
            onChange={e => set("firstTime", e.target.checked)}
          />
          This is my first time at WholeLife
        </label>
        <fieldset className="interest-chips">
          <legend>How can we help? (choose any)</legend>
          {INTERESTS.map(i => (
            <button
              type="button"
              key={i}
              className={form.interests.includes(i) ? "chip selected" : "chip"}
              aria-pressed={form.interests.includes(i)}
              onClick={() => toggle(i)}
            >
              {i}
            </button>
          ))}
        </fieldset>
        <label>
          Prayer request <span className="optional">Optional, kept private</span>
          <textarea
            value={form.prayerRequest}
            onChange={e => set("prayerRequest", e.target.value)}
            maxLength={2000}
            rows={4}
          />
        </label>
        {form.email.trim() && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={form.followUpOk}
              onChange={e => set("followUpOk", e.target.checked)}
            />
            It's OK to follow up with me by email
          </label>
        )}
        {/* Hidden from people; catches automated spam. */}
        <input
          className="hp-field"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={form.website}
          onChange={e => set("website", e.target.value)}
          name="website"
        />
        {error && (
          <p className="connection-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary wide" disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
          Send my card
        </button>
        <p className="fine-print center">
          Only our pastoral team sees your card. We never share your information.
        </p>
      </form>
    </section>
  );
}
