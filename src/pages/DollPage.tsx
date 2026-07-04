// Сторінка «doll» — розмітка 1:1 з index.html; логіка — legacy-модуль (див. src/app/legacyInit.ts).
export default function DollPage() {
  return (
    <>
      <header className="section-head doll-head">
        <div>
          <span className="eyebrow">Спорядження</span>
          <h2>Лялька персонажа</h2>
        </div>
        <button type="button" className="btn btn-ghost" id="dollReset">↺ Скинути все</button>
      </header>

      <div className="card calc-card doll-header">
        <div className="field"><label htmlFor="dollClass">Клас</label><select id="dollClass"></select></div>
        <div className="field">
          <label>Стать</label>
          <div className="segmented" role="radiogroup" aria-label="Стать">
            <input type="radio" id="dollGenderM" name="dollGender" defaultValue="m" defaultChecked />
            <label htmlFor="dollGenderM">Чол.</label>
            <input type="radio" id="dollGenderF" name="dollGender" defaultValue="f" />
            <label htmlFor="dollGenderF">Жін.</label>
          </div>
        </div>
        <div className="field"><label htmlFor="dollLevel">Рівень</label><input type="number" id="dollLevel" min="1" max="200" defaultValue="105" /></div>
        <div className="field"><label htmlFor="dollStr">Сила<b className="doll-attr-plus" id="dollStrPlus"></b></label><input type="number" id="dollStr" min="5" defaultValue="5" /></div>
        <div className="field"><label htmlFor="dollDex">Спритність<b className="doll-attr-plus" id="dollDexPlus"></b></label><input type="number" id="dollDex" min="5" defaultValue="5" /></div>
        <div className="field"><label htmlFor="dollVit">Тілобудова<b className="doll-attr-plus" id="dollVitPlus"></b></label><input type="number" id="dollVit" min="5" defaultValue="5" /></div>
        <div className="field"><label htmlFor="dollMag">Інтелект<b className="doll-attr-plus" id="dollMagPlus"></b></label><input type="number" id="dollMag" min="5" defaultValue="5" /></div>
        <div className="field doll-avail"><label>Доступно очок</label><div className="doll-avail-v" id="dollAvail">0</div></div>
      </div>

      <div className="card calc-card">
        <div className="doll-mods-head">
          <div className="segmented" role="tablist" aria-label="Модифікатори">
            <input type="radio" id="dollModTabBuffs" name="dollModTab" defaultValue="buffs" defaultChecked />
            <label htmlFor="dollModTabBuffs">Бафи</label>
            <input type="radio" id="dollModTabTitles" name="dollModTab" defaultValue="titles" />
            <label htmlFor="dollModTabTitles">Титули</label>
          </div>
          <span className="muted doll-mods-hint" id="dollModsHint">чекбокс — активувати; клік по іконці — налаштування; «+» — додати</span>
        </div>
        <div id="dollModBuffs">
          <div className="doll-buffs" id="dollBuffs"></div>
        </div>
        <div id="dollModTitles" hidden>
          <div className="doll-titles" id="dollTitles"></div>
        </div>
      </div>

      <div className="doll-main">
        <div className="card calc-card doll-main-stats">
          <h3 className="doll-stats-title">Характеристики персонажа{' '}
            <span className="muted">(база + спорядження + камені + заточка + сети + титули + стани)</span>
          </h3>
          <div className="doll-stats2" id="dollSummary"></div>
        </div>
        <div className="doll-main-eq">
          <div className="card calc-card">
            <div className="doll-fig" id="dollGrid"></div>
          </div>
          <div className="card calc-card">
            <h3 className="doll-stats-title">Рюкзак{' '}
              <span className="muted">(відкладені речі — не враховуються; клік повертає на персонажа)</span>
            </h3>
            <div className="doll-backpack" id="dollBackpack"></div>
          </div>
        </div>
      </div>

      <div className="card calc-card doll-dmg-section" id="dollDmgSection">
        <details className="doll-dmg-details">
          <summary>
            <h3 className="doll-stats-title">Перевірка дамага{' '}
              <span className="muted">(налаштуй суперника й перевір урон по ньому)</span>
            </h3>
          </summary>
          <div className="doll-opp-panel" id="dollOpp"></div>
          <div className="doll-compare-actions">
            <button type="button" className="btn btn-primary" id="dollCheckDmg">Перевірити дамаг</button>
            <button type="button" className="btn btn-ghost" id="dollResetOpp">Скинути суперника</button>
          </div>
          <div className="doll-dmg-body">
            <h4 className="doll-skills-h">Скіли класу <span className="muted">(клікни по скілу — урон додасться в лог)</span></h4>
            <div className="doll-skill-grid" id="dollSkillGrid"></div>
            <div className="doll-dmg-loghead">
              <h4 className="doll-skills-h">Лог урону</h4>
              <button type="button" className="btn btn-ghost" id="dollClearLog">Очистити</button>
            </div>
            <div className="doll-dmg-log" id="dollDmgLog"></div>
          </div>
        </details>
      </div>

      <div className="card calc-card">
        <h3 className="doll-stats-title">Збережені білди{' '}
          <span className="muted">(локально, до 20)</span>
        </h3>
        <div className="doll-save-row">
          <input type="text" id="dollBuildName" placeholder="Назва білду…" autoComplete="off" maxLength={40} />
          <button type="button" className="btn btn-primary" id="dollSaveBuild">Зберегти білд</button>
        </div>
        <div className="doll-history" id="dollHistory" style={{ marginTop: '12px' }}></div>
      </div>

      <details className="note">
        <summary>Про сторінку</summary>
        <p>
          Повний редактор: стати (5 очок/рівень), вимоги речей (рівень/Сила/Спритн/Інт —
          непридатна річ підсвічена червоним і не враховується), камені, заточка, сети,
          стани, порівняння з опонентом, збереження. Назви предметів — з ігрових даних
          і можуть бути російською. Дані та іконки — з відкритих джерел спільноти PW.
        </p>
      </details>

      {/* модалка вибору предмета (плаваючий тултіп — спільний, src/utils/tooltip.ts) */}
      <div className="doll-picker" id="dollPicker" hidden>
        <div className="doll-picker-box card">
          <header className="doll-picker-head">
            <h3 id="dollPickTitle">Слот</h3>
            <button type="button" className="btn btn-ghost" id="dollPickBackpack" hidden>У рюкзак</button>
            <button type="button" className="btn btn-ghost" id="dollPickUnequip" hidden>Зняти</button>
            <button type="button" className="doll-picker-x" id="dollPickClose" aria-label="Закрити">✕</button>
          </header>
          <input type="search" id="dollPickSearch" placeholder="80 (треб. ур.), назва…" autoComplete="off" />
          <div className="doll-pick-ctl">
            <label className="doll-pick-fit"><input type="checkbox" id="dollPickFit" /> лише придатні мені</label>
            <select id="dollPickSort" aria-label="Сортування">
              <option value="">без сортування</option>
              <option value="lvl-asc">рівень ↑</option>
              <option value="lvl-desc">рівень ↓</option>
            </select>
          </div>
          <div className="doll-pick-types" id="dollPickTypes" hidden></div>
          <p className="muted" id="dollPickCount" style={{ margin: '8px 0 0' }}></p>
          <div className="doll-picker-list" id="dollPickList"></div>
        </div>
      </div>

      {/* редактор речі (камені / заточка / характеристики) */}
      <div className="doll-picker doll-editor" id="dollEditor" hidden>
        <div className="doll-picker-box card">
          <button type="button" className="doll-picker-x doll-ed-close" aria-label="Закрити">✕</button>
          <div id="dollEditorBody"></div>
        </div>
      </div>

      {/* налаштування бафа (рівень / світл-темн / видалити) */}
      <div className="doll-picker doll-editor" id="dollBuffCfg" hidden>
        <div className="doll-picker-box card doll-bcfg-box">
          <button type="button" className="doll-picker-x doll-bcfg-x" aria-label="Закрити">✕</button>
          <div id="dollBuffCfgBody"></div>
        </div>
      </div>

      {/* пошук бафа для додавання (фільтр за класом) */}
      <div className="doll-picker" id="dollBuffPick" hidden>
        <div className="doll-picker-box card">
          <header className="doll-picker-head">
            <h3>Додати баф</h3>
            <button type="button" className="doll-picker-x doll-buffpick-x" aria-label="Закрити">✕</button>
          </header>
          <input type="search" id="dollBuffPickSearch" placeholder="назва бафа…" autoComplete="off" />
          <div className="doll-pick-types doll-buffpick-classes" id="dollBuffPickClasses"></div>
          <div className="doll-picker-list" id="dollBuffPickList"></div>
        </div>
      </div>
    </>
  );
}
