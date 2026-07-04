// =========================================================
// Уміння питомця — ідіоматичний React (фаза 3).
// =========================================================

import { useEffect, useState } from 'react';
import { loadPets, petIconUrl, renderTpl, type PetSkill } from '../modules/skills/data';

function InfoRow({ label, val }: { label: string; val: string }) {
  if (val == null || val === '' || val === '-') return null;
  return (
    <div className="skl-info">
      <span className="skl-info-l">{label}</span>
      <span className="skl-info-v">{val}</span>
    </div>
  );
}

export default function PetsPage() {
  const [pets, setPets] = useState<PetSkill[] | null>(null);
  const [cur, setCur] = useState(0);
  const [lvl, setLvl] = useState(0);

  useEffect(() => {
    let alive = true;
    loadPets().then((p) => { if (alive) setPets(p); });
    return () => { alive = false; };
  }, []);

  const head = (
    <header className="section-head">
      <span className="eyebrow">Скілбаза</span>
      <h2>Уміння питомця</h2>
      <p>Бойові вміння питомців. Рівні (1 / 20 / 40 / 60 / 80) показують силу вміння й вартість.</p>
    </header>
  );

  if (!pets) {
    return (
      <>
        {head}
        <div className="skl-layout skl-layout-pet">
          <div className="card skl-petwrap"><div className="skl-petlist" id="sklPetGrid"></div></div>
          <div className="card skl-detail" id="sklPetDetail"><p className="muted skl-empty">Завантаження…</p></div>
        </div>
      </>
    );
  }

  const s = pets[cur];
  const curLvl = lvl >= s.levels ? 0 : lvl;

  return (
    <>
      {head}
      <div className="skl-layout skl-layout-pet">
        <div className="card skl-petwrap">
          <div className="skl-petlist" id="sklPetGrid">
            {pets.map((p, i) => (
              <button key={p.id} type="button" className={'skl-petrow' + (i === cur ? ' active' : '')} onClick={() => { setCur(i); setLvl(0); }}>
                <img className="skl-petico" src={petIconUrl(p.id)} alt="" loading="lazy" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card skl-detail" id="sklPetDetail">
          <div className="skl-detail-head">
            <h3 className="skl-name">{s.name}</h3>
            <span className="skl-lvltag">{'Рівень ' + (curLvl + 1)}</span>
          </div>
          {s.levels > 1 && (
            <div className="skl-levels">
              {Array.from({ length: s.levels }, (_, i) => (
                <button key={i} type="button" className={'skl-lvl' + (curLvl === i ? ' active' : '')} onClick={() => setLvl(i)}>{i + 1}</button>
              ))}
            </div>
          )}
          <div className="skl-stats">
            <InfoRow label="Потрібний рівень пета" val={s.stats['0']?.[curLvl] ?? ''} />
            <InfoRow label="Дух" val={s.stats['1']?.[curLvl] ?? ''} />
          </div>
          <div className="skl-text" dangerouslySetInnerHTML={{ __html: renderTpl(s.tpl, s.stats, curLvl) }} />
        </div>
      </div>
    </>
  );
}
