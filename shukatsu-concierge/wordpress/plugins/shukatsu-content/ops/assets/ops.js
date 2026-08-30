(function () {
  const cfg = window.shukatsuOps || {};
  const toastEl = document.getElementById('ops-toast');

  function toast(message, isError) {
    if (!toastEl) {
      window.alert(message);
      return;
    }
    toastEl.hidden = false;
    toastEl.textContent = message;
    toastEl.classList.toggle('is-error', !!isError);
    toastEl.classList.toggle('is-ok', !isError);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function syncVisualToTextarea(wrap) {
    const ta = wrap.querySelector('textarea[name="content"]');
    const canvas = wrap.querySelector('.ops-visual__canvas');
    if (!ta || !canvas) return;
    const html = canvas.innerHTML;
    const text = (canvas.textContent || '').replace(/\s+/g, '');
    ta.value = text ? html : '';
    canvas.classList.toggle('is-empty', !text);
  }

  function syncTextareaToVisual(ta) {
    const wrap = ta.closest('[data-ops-visual]');
    if (!wrap) return;
    const canvas = wrap.querySelector('.ops-visual__canvas');
    if (!canvas) return;
    canvas.innerHTML = ta.value || '';
    const text = (canvas.textContent || '').replace(/\s+/g, '');
    canvas.classList.toggle('is-empty', !text);
  }

  function formToBody(form) {
    form.querySelectorAll('[data-ops-visual]').forEach(syncVisualToTextarea);
    const body = new FormData(form);
    body.set('nonce', cfg.nonce || '');
    const postId = form.getAttribute('data-post-id') || '0';
    body.set('post_id', postId);
    // unchecked checkboxes
    ['needs_review', 'case_anonymized', 'topic_pin', 'dance_cancelled'].forEach(function (name) {
      const el = form.querySelector('[name="' + name + '"]');
      if (el && el.type === 'checkbox' && !el.checked) {
        body.delete(name);
      }
    });
    return body;
  }

  async function postAction(action, body) {
    body.set('action', action);
    const res = await fetch(cfg.ajaxUrl, {
      method: 'POST',
      body: body,
      credentials: 'same-origin',
    });
    const data = await res.json();
    if (!data || !data.success) {
      const msg = data && data.data && data.data.message ? data.data.message : '処理に失敗しました。';
      throw new Error(msg);
    }
    return data.data || {};
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
  }

  document.addEventListener('click', async function (ev) {
    const btn = ev.target.closest('[data-ops-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-ops-action');
    const form = btn.closest('form');
    if (!form) return;

    try {
      setBusy(btn, true);

      if (action === 'save-column') {
        const data = await postAction('shukatsu_ops_save_column', formToBody(form));
        toast(data.message || '保存しました。');
        if (data.edit_url && String(form.getAttribute('data-post-id') || '0') === '0') {
          window.location.href = data.edit_url;
          return;
        }
        form.setAttribute('data-post-id', String(data.post_id || ''));
      }

      if (action === 'compose-column') {
        const cat = form.querySelector('input[name="category_key"]:checked');
        const topic = form.querySelector('input[name="topic_key"]:checked');
        if (!cat) throw new Error('カテゴリを選んでください。');
        if (!topic) throw new Error('テーマを選んでください。');
        const noteEl = form.querySelector('[name="note"]');
        const note = noteEl ? String(noteEl.value || '').trim() : '';
        if (topic.value === 'other' && note === '') {
          throw new Error('「その他」のときは「伝えたいこと」を入力してください。');
        }
        toast('最新情報を検索しながら下書きを作成し、AI再チェック中です。1〜2分かかることがあります…');
        const data = await postAction('shukatsu_ops_compose_column', formToBody(form));
        toast(data.message || '下書きを作成しました。');
        if (data.edit_url) {
          window.setTimeout(function () {
            window.location.href = data.edit_url;
          }, 600);
        }
        return;
      }

      if (action === 'publish-column') {
        const needs = form.querySelector('[name="needs_review"]');
        if (needs && needs.checked) {
          throw new Error('「要確認」のチェックを外してから公開してください。');
        }
        const ack = form.querySelector('[name="ai_review_ack"]');
        if (ack && !ack.checked) {
          throw new Error('「AIチェック結果を確認した」にチェックを入れてから公開してください。');
        }
        if (!window.confirm('このコラムをサイトに公開します。よろしいですか？')) {
          setBusy(btn, false);
          return;
        }
        // save first
        await postAction('shukatsu_ops_save_column', formToBody(form));
        const data = await postAction('shukatsu_ops_publish_column', formToBody(form));
        toast(data.message || '公開しました。');
        if (data.public_url) {
          window.setTimeout(function () {
            window.location.reload();
          }, 700);
        }
      }

      if (action === 'delete-column') {
        if (!window.confirm('このコラムを削除しますか？\n（ゴミ箱へ移します。一覧からは消えます）')) {
          setBusy(btn, false);
          return;
        }
        const data = await postAction('shukatsu_ops_delete_column', formToBody(form));
        toast(data.message || '削除しました。');
        window.setTimeout(function () {
          window.location.href = data.list_url || (cfg.urls && cfg.urls.columns) || '/ops/columns/';
        }, 600);
        return;
      }

      if (action === 'delete-case') {
        if (!window.confirm('この解決事例を削除しますか？\n（ゴミ箱へ移します。一覧からは消えます）')) {
          setBusy(btn, false);
          return;
        }
        const data = await postAction('shukatsu_ops_delete_case', formToBody(form));
        toast(data.message || '削除しました。');
        window.setTimeout(function () {
          window.location.href = data.list_url || (cfg.urls && cfg.urls.cases) || '/ops/cases/';
        }, 600);
        return;
      }

      if (action === 'save-topic') {
        const data = await postAction('shukatsu_ops_save_topic', formToBody(form));
        toast(data.message || '保存しました。');
        if (data.edit_url && String(form.getAttribute('data-post-id') || '0') === '0') {
          window.location.href = data.edit_url;
          return;
        }
        form.setAttribute('data-post-id', String(data.post_id || ''));
      }

      if (action === 'publish-topic') {
        if (!window.confirm('このトピックスをトップに公開します。よろしいですか？')) {
          setBusy(btn, false);
          return;
        }
        const data = await postAction('shukatsu_ops_publish_topic', formToBody(form));
        toast(data.message || '公開しました。');
        form.setAttribute('data-post-id', String(data.post_id || ''));
        window.setTimeout(function () {
          if (data.edit_url && !window.location.pathname.match(/\/topics\/\d+/)) {
            window.location.href = data.edit_url;
          } else {
            window.location.reload();
          }
        }, 700);
      }

      if (action === 'delete-topic') {
        if (!window.confirm('このトピックスを削除しますか？\n（ゴミ箱へ移します。一覧からは消えます）')) {
          setBusy(btn, false);
          return;
        }
        const data = await postAction('shukatsu_ops_delete_topic', formToBody(form));
        toast(data.message || '削除しました。');
        window.setTimeout(function () {
          window.location.href = data.list_url || (cfg.urls && cfg.urls.topics) || '/ops/topics/';
        }, 600);
        return;
      }

      if (action === 'save-dance') {
        const data = await postAction('shukatsu_ops_save_dance', formToBody(form));
        toast(data.message || '保存しました。');
        if (data.edit_url && String(form.getAttribute('data-post-id') || '0') === '0') {
          window.location.href = data.edit_url;
          return;
        }
        form.setAttribute('data-post-id', String(data.post_id || ''));
      }

      if (action === 'publish-dance') {
        if (!window.confirm('この日程を公開します。\nトップページと踊活ページに表示されます。')) {
          setBusy(btn, false);
          return;
        }
        const data = await postAction('shukatsu_ops_publish_dance', formToBody(form));
        toast(data.message || '公開データとして保存しました。');
        form.setAttribute('data-post-id', String(data.post_id || ''));
        window.setTimeout(function () {
          if (data.edit_url && !window.location.pathname.match(/\/dancing\/\d+/)) {
            window.location.href = data.edit_url;
          } else {
            window.location.reload();
          }
        }, 700);
      }

      if (action === 'delete-dance') {
        if (!window.confirm('この日程を削除しますか？\n（ゴミ箱へ移します。一覧からは消えます）')) {
          setBusy(btn, false);
          return;
        }
        const data = await postAction('shukatsu_ops_delete_dance', formToBody(form));
        toast(data.message || '削除しました。');
        window.setTimeout(function () {
          window.location.href = data.list_url || (cfg.urls && cfg.urls.dancing) || '/ops/dancing/';
        }, 600);
        return;
      }

      if (action === 'save-case') {
        const data = await postAction('shukatsu_ops_save_case', formToBody(form));
        toast(data.message || '保存しました。');
        if (data.edit_url && String(form.getAttribute('data-post-id') || '0') === '0') {
          window.location.href = data.edit_url;
          return;
        }
        form.setAttribute('data-post-id', String(data.post_id || ''));
      }

      if (action === 'publish-case') {
        if (!window.confirm('この解決事例をサイトに公開します。匿名化と本文を確認済みですか？')) {
          setBusy(btn, false);
          return;
        }
        await postAction('shukatsu_ops_save_case', formToBody(form));
        const data = await postAction('shukatsu_ops_publish_case', formToBody(form));
        toast(data.message || '公開しました。');
        window.setTimeout(function () {
          window.location.reload();
        }, 700);
      }

      if (action === 'ai-case') {
        const postId = form.getAttribute('data-post-id') || '0';
        if (postId === '0') {
          throw new Error('先に「下書き保存」してください。');
        }
        // save intake first
        await postAction('shukatsu_ops_save_case', formToBody(form));
        toast('文章を作成中です。しばらくお待ちください…');
        const body = new FormData();
        body.set('action', 'shukatsu_generate_case_draft');
        body.set('post_id', postId);
        body.set('nonce', cfg.aiNonce || '');
        const res = await fetch(cfg.ajaxUrl, { method: 'POST', body: body, credentials: 'same-origin' });
        const data = await res.json();
        if (!data || !data.success) {
          throw new Error((data && data.data && data.data.message) || '文章作成に失敗しました。');
        }
        toast(data.data.message || '文章を作成しました。');
        window.setTimeout(function () {
          window.location.reload();
        }, 800);
        return;
      }
    } catch (err) {
      toast(err && err.message ? err.message : String(err), true);
    } finally {
      setBusy(btn, false);
    }
  });

  // Visual body editor (published look)
  (function initVisualEditors() {
    document.querySelectorAll('[data-ops-visual]').forEach(function (wrap) {
      const ta = wrap.querySelector('textarea[name="content"]');
      const canvas = wrap.querySelector('.ops-visual__canvas');
      if (!ta || !canvas) return;

      let fromCanvas = false;
      canvas.addEventListener('input', function () {
        fromCanvas = true;
        syncVisualToTextarea(wrap);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        fromCanvas = false;
      });
      ta.addEventListener('input', function () {
        if (fromCanvas) return;
        syncTextareaToVisual(ta);
      });
      canvas.addEventListener('paste', function (e) {
        e.preventDefault();
        const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
        document.execCommand('insertText', false, text);
      });
      wrap.querySelectorAll('[data-cmd]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          canvas.focus();
          const cmd = btn.getAttribute('data-cmd');
          if (cmd === 'h2') {
            document.execCommand('formatBlock', false, 'h2');
          } else if (cmd === 'p') {
            document.execCommand('formatBlock', false, 'p');
          } else if (cmd === 'bold') {
            document.execCommand('bold');
          } else if (cmd === 'ul') {
            document.execCommand('insertUnorderedList');
          } else if (cmd === 'link') {
            const url = window.prompt('リンク先URL', 'https://');
            if (url) {
              document.execCommand('createLink', false, url);
            }
          }
          syncVisualToTextarea(wrap);
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    });
  })();

  // Column length guide + live count
  (function initLengthGuide() {
    const ta = document.getElementById('ops-column-content');
    const status = document.getElementById('ops-length-status');
    const form = document.getElementById('ops-column-form');
    if (!ta || !status || !form) return;
    const presets = cfg.lengthPresets || {};

    function plainLength(html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html || '';
      const text = (tmp.textContent || '').replace(/\s+/g, '');
      return text.length;
    }

    function selectedKey() {
      const checked = form.querySelector('input[name="target_length"]:checked');
      return checked ? checked.value : 'standard';
    }

    function render() {
      const key = selectedKey();
      const preset = presets[key] || { chars: 1500, label: '標準', minutes: '約4分' };
      const current = plainLength(ta.value);
      const target = Number(preset.chars) || 1500;
      const diff = current - target;
      const ratio = current / target;
      status.classList.remove('is-ok', 'is-under', 'is-over');
      let tip = '';
      if (current === 0) {
        status.classList.add('is-under');
        tip = '本文がまだありません。';
      } else if (ratio < 0.75) {
        status.classList.add('is-under');
        tip = '目安より短めです。具体例や見出しを足す余地があります。';
      } else if (ratio > 1.2) {
        status.classList.add('is-over');
        tip = '目安より長めです。重複説明を削ると読みやすくなります。';
      } else {
        status.classList.add('is-ok');
        tip = '目安のボリュームに近い長さです。';
      }
      const sign = diff === 0 ? '±0' : (diff > 0 ? '+' + diff : String(diff));
      status.textContent =
        'いまの本文 ' + current.toLocaleString('ja-JP') + '字 ／ 目安 約' + target.toLocaleString('ja-JP') +
        '字（' + (preset.label || '') + '・読む目安 ' + (preset.minutes || '') + '）／ 差 ' + sign + '字。' + tip;
    }

    ta.addEventListener('input', render);
    form.querySelectorAll('input[name="target_length"]').forEach(function (el) {
      el.addEventListener('change', render);
    });
    render();
  })();

  // Source links: list for confirmation + import from body
  (function initSourceLinks() {
    const ta = document.getElementById('ops-source-urls');
    const content = document.getElementById('ops-column-content');
    const list = document.getElementById('ops-source-list');
    const importBtn = document.getElementById('ops-import-body-links');
    if (!ta || !list) return;

    function extract(text) {
      const re = /https?:\/\/[^\s<>"'\)\]\}]+/g;
      const found = text.match(re) || [];
      const out = [];
      const seen = {};
      found.forEach(function (raw) {
        let url = raw.replace(/[.,;:。、）)」』\]]+$/g, '');
        const key = url.replace(/\/$/, '').toLowerCase();
        if (!seen[key]) {
          seen[key] = true;
          out.push(url);
        }
      });
      return out;
    }

    function parseTextarea() {
      return ta.value
        .split(/\r?\n/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return /^https?:\/\//i.test(s); });
    }

    function render() {
      const urls = parseTextarea();
      if (!urls.length) {
        list.innerHTML = '<p class="ops-hint">まだリンクがありません。手入力するか、「本文からリンクを取り込む」を使ってください。</p>';
        return;
      }
      const items = urls.map(function (url, i) {
        const isPdf = /\.pdf($|\?)/i.test(url);
        const badge = isPdf ? '<span class="ops-source-badge">PDF</span>' : '<span class="ops-source-badge ops-source-badge--web">WEB</span>';
        return (
          '<li>' +
            badge +
            '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' +
            '<span class="ops-source-index">' + (i + 1) + '</span>' +
          '</li>'
        );
      }).join('');
      list.innerHTML =
        '<p class="ops-source-list__title">確認用一覧（クリックで開きます）・' + urls.length + '件</p>' +
        '<ul class="ops-source-list__ul">' + items + '</ul>';
    }

    ta.addEventListener('input', render);
    if (importBtn && content) {
      importBtn.addEventListener('click', function () {
        const fromBody = extract(content.value || '');
        const current = parseTextarea();
        const merged = [];
        const seen = {};
        current.concat(fromBody).forEach(function (url) {
          const key = url.replace(/\/$/, '').toLowerCase();
          if (!seen[key]) {
            seen[key] = true;
            merged.push(url);
          }
        });
        ta.value = merged.join('\n');
        render();
        toast(merged.length ? ('リンクを' + merged.length + '件に整えました。') : '本文からリンクが見つかりませんでした。');
      });
    }
    render();
  })();

  // Column compose: category -> topic branching
  (function initCompose() {
    const form = document.getElementById('ops-compose-form');
    if (!form) return;
    let tree = cfg.topicTree || {};
    const jsonEl = document.getElementById('ops-topic-tree-json');
    if (jsonEl && jsonEl.textContent) {
      try { tree = JSON.parse(jsonEl.textContent); } catch (e) {}
    }
    let counts = {};
    const countsEl = document.getElementById('ops-column-counts-json');
    if (countsEl && countsEl.textContent) {
      try { counts = JSON.parse(countsEl.textContent); } catch (e) {}
    }
    const topicStep = document.getElementById('ops-topic-step');
    const topicStepTitle = document.getElementById('ops-topic-step-title');
    const topicSummary = document.getElementById('ops-topic-step-summary');
    const topicGrid = document.getElementById('ops-topic-grid');
    const optionStep = document.getElementById('ops-option-step');
    const noteEl = document.getElementById('ops-compose-note');
    const noteLabel = document.getElementById('ops-compose-note-label');
    const noteHint = document.getElementById('ops-compose-note-hint');

    function syncNoteRequired() {
      const topic = form.querySelector('input[name="topic_key"]:checked');
      const isOther = !!(topic && topic.value === 'other');
      if (noteEl) {
        noteEl.required = isOther;
        if (isOther) {
          noteEl.setAttribute('placeholder', '例：〇〇について、△△向けに□□を伝えたい');
        } else {
          noteEl.setAttribute('placeholder', '例：遠方家族向けに、連絡体制の話を厚めにしたい');
        }
      }
      if (noteLabel) {
        noteLabel.textContent = isOther ? '伝えたいこと（必須）' : '伝えたいこと（任意）';
      }
      if (noteHint) {
        noteHint.hidden = !isOther;
      }
    }

    function renderTopics(catKey) {
      const cat = tree[catKey];
      topicGrid.innerHTML = '';
      if (!cat || !cat.children) {
        topicStep.hidden = true;
        optionStep.hidden = true;
        return;
      }
      const catCount = (counts.categories && counts.categories[catKey]) ? counts.categories[catKey] : 0;
      const topicCounts = (counts.topics && counts.topics[catKey]) ? counts.topics[catKey] : {};
      if (topicStepTitle) {
        topicStepTitle.innerHTML = '2. テーマ（詳細） <span class="ops-count-total">このカテゴリ 公開 ' + catCount + '件</span>';
      }
      if (topicSummary) {
        topicSummary.textContent = '';
        topicSummary.hidden = true;
      }
      Object.keys(cat.children).forEach(function (topicKey) {
        const t = cat.children[topicKey];
        const n = topicCounts[topicKey] || 0;
        const label = document.createElement('label');
        label.className = 'ops-topic-card';
        label.innerHTML =
          '<input type="radio" name="topic_key" value="' + topicKey + '" required>' +
          '<span class="ops-topic-card__label"></span>' +
          '<span class="ops-topic-card__blurb"></span>' +
          '<span class="ops-topic-card__count"></span>';
        label.querySelector('.ops-topic-card__label').textContent = t.label || topicKey;
        label.querySelector('.ops-topic-card__blurb').textContent = t.blurb || '';
        label.querySelector('.ops-topic-card__count').textContent = '公開 ' + n + '件';
        topicGrid.appendChild(label);
      });
      topicStep.hidden = false;
      optionStep.hidden = true;
      syncNoteRequired();
    }

    form.querySelectorAll('input[name="category_key"]').forEach(function (el) {
      el.addEventListener('change', function () {
        renderTopics(el.value);
      });
    });
    topicGrid.addEventListener('change', function (ev) {
      if (ev.target && ev.target.name === 'topic_key') {
        syncNoteRequired();
        optionStep.hidden = false;
        optionStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (ev.target.value === 'other' && noteEl) {
          noteEl.focus();
        }
      }
    });
  })();

  // AI assist (revise / ask) on column edit
  (function initAssist() {
    const btn = document.getElementById('ops-assist-submit');
    const form = document.getElementById('ops-column-form');
    const msgEl = document.getElementById('ops-assist-message');
    const logEl = document.getElementById('ops-assist-log');
    if (!btn || !form || !msgEl) return;

    btn.addEventListener('click', async function () {
      const message = (msgEl.value || '').trim();
      if (!message) {
        toast('内容を入力してください。', true);
        return;
      }
      const modeEl = document.querySelector('input[name="assist_mode"]:checked');
      const mode = modeEl ? modeEl.value : 'ask';
      try {
        setBusy(btn, true);
        toast(mode === 'revise' ? '修正案を作成中です…' : '回答を作成中です…');
        const body = formToBody(form);
        body.set('mode', mode);
        body.set('message', message);
        const data = await postAction('shukatsu_ops_assist_column', body);
        if (data.title) {
          const t = form.querySelector('[name="title"]');
          if (t) t.value = data.title;
        }
        if (data.meta_description) {
          const m = form.querySelector('[name="meta_description"]');
          if (m) m.value = data.meta_description;
        }
        if (data.content) {
          const c = form.querySelector('[name="content"]');
          if (c) {
            c.value = data.content;
            syncTextareaToVisual(c);
            c.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        if (data.source_urls) {
          const s = form.querySelector('[name="source_urls"]');
          if (s) {
            s.value = data.source_urls;
            s.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        const needs = form.querySelector('[name="needs_review"]');
        if (needs) needs.checked = true;
        const ack = form.querySelector('[name="ai_review_ack"]');
        if (ack) ack.checked = false;
        if (logEl && data.log_html) {
          logEl.innerHTML = data.log_html;
        }
        msgEl.value = '';
        toast(data.message || '完了しました。');
      } catch (err) {
        toast(err && err.message ? err.message : String(err), true);
      } finally {
        setBusy(btn, false);
      }
    });
  })();

  // Topic link type toggle
  (function initTopicLink() {
    const form = document.getElementById('ops-topic-form');
    const wrap = document.getElementById('ops-topic-link-wrap');
    if (!form || !wrap) return;
    function sync() {
      const checked = form.querySelector('input[name="topic_link_type"]:checked');
      const type = checked ? checked.value : 'none';
      wrap.hidden = type === 'none';
    }
    form.querySelectorAll('input[name="topic_link_type"]').forEach(function (el) {
      el.addEventListener('change', sync);
    });
    sync();
  })();

  // 踊活：過去の予定から日付以外を貼り付け
  (function initDancePaste() {
    const form = document.getElementById('ops-dance-form');
    const btn = document.getElementById('ops-dance-paste-btn');
    const select = document.getElementById('ops-dance-paste-select');
    const dataEl = document.getElementById('ops-dance-paste-data');
    if (!form || !btn || !select || !dataEl) return;

    let templates = [];
    try {
      templates = JSON.parse(dataEl.textContent || '[]');
    } catch (e) {
      templates = [];
    }
    const byId = {};
    templates.forEach(function (t) {
      byId[String(t.id)] = t;
    });

    btn.addEventListener('click', function () {
      const id = String(select.value || '');
      const tpl = byId[id];
      if (!tpl) {
        toast('コピー元の予定を選んでください。', true);
        return;
      }
      const title = form.querySelector('[name="title"]');
      if (title) title.value = tpl.title || '';
      const kind = form.querySelector('input[name="dance_kind"][value="' + (tpl.kind || 'lesson') + '"]');
      if (kind) kind.checked = true;
      const start = form.querySelector('[name="dance_start_time"]');
      if (start) start.value = tpl.start_time || '';
      const end = form.querySelector('[name="dance_end_time"]');
      if (end) end.value = tpl.end_time || '';
      const venue = form.querySelector('[name="dance_venue"]');
      if (venue) venue.value = tpl.venue || '';
      const detail = form.querySelector('[name="dance_venue_detail"]');
      if (detail) detail.value = tpl.venue_detail || '';
      const note = form.querySelector('[name="dance_note"]');
      if (note) note.value = tpl.note || '';
      // 開催日・中止は触らない
      toast('日付以外を貼り付けました。開催日を確認してください。');
    });
  })();
})();
