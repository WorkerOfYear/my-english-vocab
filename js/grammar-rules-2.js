// Grammar rules, units 6–10 (see js/grammar-rules-1.js for the format).
window.GRAMMAR = (window.GRAMMAR || []).concat([
  {
    id: "verb-object", unit: "6A", title: "Verb + object + infinitive or gerund", ru: "Глагол + дополнение + инфинитив или -ing",
    explain: `
      <h4>+ объект + to do</h4>
      <p><i>want, would like, ask, tell, advise, persuade, encourage, remind, warn, allow, expect, invite, force, teach</i>: <span class="ex">She persuaded me to stay.</span> <span class="ex">I'd like you to meet my boss.</span> Отрицание: <span class="ex">He warned us not to swim there.</span></p>
      <p>⚠️ <b>want / would like</b> не используют с that: <span class="ex">I want you to come.</span> (не «I want that you come»).</p>
      <h4>+ объект + do (без to)</h4>
      <p><b>make</b> и <b>let</b>: <span class="ex">They made us wait.</span> <span class="ex">Let me help you.</span> В пассиве make уже с to: <span class="ex">We were made to wait.</span> <b>help</b> — с to и без: <span class="ex">She helped me (to) move.</span></p>
      <h4>+ объект + -ing</h4>
      <p><i>mind, imagine, can't stand, don't like, remember, catch, see/hear</i> (процесс): <span class="ex">I don't mind you borrowing my car.</span> <span class="ex">Can you imagine him dancing?</span> В формальном стиле — притяжательное: <i>I don't mind your borrowing…</i></p>
      <h4>suggest, recommend, insist</h4>
      <p>Не используют объект + to: <span class="ex">I suggest (that) you take a taxi.</span> <span class="ex">He suggested going for a walk.</span> (не «suggested me to go»).</p>`,
    ex: [
      { q: "My parents want ___ a doctor.", opts: ["that I become", "me to become", "me becoming"], a: 1, why: "Want + объект + to do." },
      { q: "The teacher made us ___ the essay again.", opts: ["write", "to write", "writing"], a: 0, why: "Make + объект + глагол без to." },
      { q: "We were made ___ for two hours.", opts: ["wait", "to wait", "waiting"], a: 1, why: "В пассиве make используется с to." },
      { q: "My doctor advised me ___ (not / drink) coffee.", a: ["not to drink"], hint: "3 слова", why: "Advise + объект + not to do." },
      { q: "Do you mind me ___ (open) the window?", a: ["opening"], hint: "форма глагола", why: "Mind + объект + -ing." },
      { q: "She suggested ___ the meeting until Monday.", opts: ["us to postpone", "postponing", "to postpone"], a: 1, why: "Suggest + -ing или suggest that…, но не suggest + объект + to." },
      { q: "My boss won't let me ___ from home.", opts: ["work", "to work", "working"], a: 0, why: "Let + объект + глагол без to." },
      { q: "Can you remind me ___ (call) the bank tomorrow?", a: ["to call"], hint: "2 слова", why: "Remind + объект + to do." },
      { q: "I can't imagine my grandmother ___ a motorbike!", opts: ["to ride", "riding", "ride"], a: 1, why: "Imagine + объект + -ing." },
      { q: "They persuaded him ___ the offer.", a: ["to accept", "to take"], hint: "2 слова", why: "Persuade + объект + to do." },
    ],
  },
  {
    id: "conditionals", unit: "6B", title: "Conditional sentences", ru: "Условные предложения: смешанные, unless, provided, инверсия",
    explain: `
      <h4>Основные типы</h4>
      <ul>
        <li><b>Реальное</b> (0 и 1): <span class="ex">If you heat ice, it melts.</span> <span class="ex">If it rains, we'll stay in.</span></li>
        <li><b>Нереальное настоящее/будущее</b> (2): <span class="ex">If I had more time, I'd learn the guitar.</span></li>
        <li><b>Нереальное прошлое</b> (3): <span class="ex">If we'd left earlier, we wouldn't have missed it.</span></li>
      </ul>
      <h4>Смешанные условия</h4>
      <ul>
        <li>Прошлое условие → результат сейчас: <b>if + past perfect, would + глагол</b>: <span class="ex">If I'd taken that job, I'd be living in Canada now.</span></li>
        <li>Постоянное условие → результат в прошлом: <b>if + past, would have + 3-я форма</b>: <span class="ex">If I weren't so shy, I would have spoken to her.</span></li>
      </ul>
      <h4>Альтернативы if</h4>
      <ul>
        <li><b>unless</b> = if … not: <span class="ex">I won't go unless you come too.</span></li>
        <li><b>provided / providing (that), as long as, on condition that</b> — «при условии что»: <span class="ex">You can borrow it as long as you return it.</span></li>
        <li><b>otherwise</b>, <b>supposing</b>, <b>even if</b> (даже если), <b>in case</b> (на всякий случай — это не условие!).</li>
      </ul>
      <h4>Формальная инверсия (без if)</h4>
      <p><span class="ex">Should you need help, call me.</span> (= If you should need) <span class="ex">Had I known, I would have come.</span> (= If I had known) <span class="ex">Were she to resign, …</span></p>`,
    ex: [
      { q: "If I ___ harder at school, I'd have a better job now.", opts: ["studied", "had studied", "would study"], a: 1, why: "Смешанное: прошлое условие (had studied) → результат сейчас (would have)." },
      { q: "If she weren't so stubborn, she ___ his apology yesterday.", opts: ["would accept", "would have accepted", "had accepted"], a: 1, why: "Постоянная черта → результат в прошлом: would have + 3-я форма." },
      { q: "You won't pass ___ you start working harder.", opts: ["if", "unless", "provided"], a: 1, why: "Unless = if … not." },
      { q: "You can use my car ___ long as you're careful.", a: ["as"], hint: "1 слово", why: "As long as — при условии что." },
      { q: "___ I known about the problem, I would have helped.", a: ["Had", "had"], hint: "1 слово", why: "Инверсия: Had I known = If I had known." },
      { q: "___ you have any questions, please contact us.", opts: ["Should", "Would", "Unless"], a: 0, why: "Should you… = If you (should) have…" },
      { q: "If I ___ you, I'd apologize.", opts: ["am", "were", "had been"], a: 1, why: "Нереальное настоящее: If I were you." },
      { q: "We'll go to the beach ___ it's sunny tomorrow.", opts: ["provided", "unless", "in case"], a: 0, why: "Provided (that) — при условии что." },
      { q: "If we ___ (not / miss) the bus, we would have got there on time.", a: ["hadn't missed", "had not missed"], hint: "2–3 слова", why: "Нереальное прошлое: if + past perfect." },
      { q: "I'm going to the party ___ if it rains — nothing will stop me!", a: ["even"], hint: "1 слово", why: "Even if — даже если." },
    ],
  },
  {
    id: "obligation", unit: "7A", title: "Permission, obligation, and necessity", ru: "Разрешение, обязанность, необходимость: be allowed to, be supposed to, needn't have…",
    explain: `
      <h4>Разрешение и запрет</h4>
      <ul>
        <li><b>can / be allowed to / be permitted to</b> (формально): <span class="ex">You're not allowed to park here.</span> В прошлом и будущем — <i>was allowed to / will be allowed to</i>.</li>
        <li><b>let</b> + объект + глагол: <span class="ex">They let us leave early.</span></li>
        <li><b>mustn't / can't</b> — запрещено. Не путать: <b>don't have to</b> — не обязательно.</li>
      </ul>
      <h4>Обязанность</h4>
      <ul>
        <li><b>must</b> — личная необходимость или правило (письменно); <b>have to</b> — внешняя обязанность: <span class="ex">I have to wear a tie at work.</span></li>
        <li><b>be supposed to</b> — «по правилам/по плану должен», часто когда это не выполняется: <span class="ex">You're supposed to be in bed!</span></li>
        <li><b>be required to / be obliged to</b> — формально. <b>had better</b> — совет с предупреждением: <span class="ex">You'd better hurry.</span></li>
      </ul>
      <h4>Необходимость в прошлом</h4>
      <ul>
        <li><b>didn't need to / didn't have to</b> — не было нужно (и обычно не делали): <span class="ex">I didn't need to buy a ticket — it was free.</span></li>
        <li><b>needn't have + 3-я форма</b> — сделали, но зря: <span class="ex">You needn't have cooked — we've already eaten.</span></li>
        <li><b>should have / ought to have</b> — надо было, но не сделали.</li>
      </ul>`,
    ex: [
      { q: "You ___ smoke in here — it's against the law.", opts: ["mustn't", "don't have to", "needn't"], a: 0, why: "Запрет — mustn't." },
      { q: "Tomorrow's a holiday, so I ___ get up early.", opts: ["mustn't", "don't have to", "am not allowed to"], a: 1, why: "Нет необходимости — don't have to." },
      { q: "When I was young, I wasn't ___ to stay out after ten.", a: ["allowed", "permitted"], hint: "1 слово", why: "Be allowed to — разрешение (в прошлом wasn't allowed to)." },
      { q: "You ___ have bought milk — there's plenty in the fridge.", a: ["needn't", "need not"], hint: "1–2 слова", why: "Needn't have + 3-я форма — сделал, но было не нужно." },
      { q: "We ___ to take a taxi because Tom gave us a lift.", opts: ["needn't have", "didn't need", "mustn't"], a: 1, why: "Didn't need to — нужды не было (и не брали такси)." },
      { q: "The meeting is ___ to start at nine, but the boss is always late.", opts: ["supposed", "allowed", "obliged"], a: 0, why: "Be supposed to — по плану должно, но на деле иначе." },
      { q: "You'd ___ take an umbrella — it looks like rain.", a: ["better"], hint: "1 слово", why: "Had better — совет: лучше сделай." },
      { q: "All passengers are ___ to show their passports.", opts: ["required", "let", "supposed"], a: 0, why: "Be required to — формальная обязанность." },
      { q: "My parents never ___ me stay up late.", opts: ["allowed", "let", "permitted"], a: 1, why: "Let + объект + глагол без to (allowed / permitted потребовали бы to)." },
      { q: "I ___ have told her — now she's upset.", opts: ["shouldn't", "needn't", "didn't need to"], a: 0, why: "Shouldn't have — сожаление: не надо было (это было ошибкой)." },
    ],
  },
  {
    id: "senses", unit: "7B", title: "Verbs of the senses", ru: "Глаголы чувств: look / sound / feel + прилагательное, like, as if; see sb do / doing",
    explain: `
      <h4>look, feel, smell, sound, taste</h4>
      <ul>
        <li>+ <b>прилагательное</b> (не наречие!): <span class="ex">You look tired.</span> <span class="ex">This soup tastes delicious.</span></li>
        <li>+ <b>like</b> + существительное: <span class="ex">It smells like burnt toast.</span> <span class="ex">She looks like her mother.</span></li>
        <li>+ <b>as if / as though / like</b> + предложение: <span class="ex">It sounds as if they're arguing.</span></li>
        <li>Обычно не в Continuous и часто с <b>can</b>: <span class="ex">I can smell gas.</span> (не «I'm smelling»). Но <i>feel</i> о самочувствии — можно: <i>I'm feeling better.</i></li>
      </ul>
      <h4>see, hear, watch, notice, feel + объект + do / doing</h4>
      <ul>
        <li><b>+ глагол без to</b> — видел действие целиком: <span class="ex">I saw him cross the road.</span></li>
        <li><b>+ -ing</b> — видел часть, в процессе: <span class="ex">I heard someone singing next door.</span></li>
      </ul>
      <h4>seem</h4>
      <p>Похоже по впечатлению в целом: <span class="ex">She seems (to be) happy.</span> <span class="ex">It seems like a good idea.</span></p>`,
    ex: [
      { q: "This cake tastes ___ !", opts: ["wonderfully", "wonderful", "like wonderful"], a: 1, why: "Глаголы чувств + прилагательное." },
      { q: "You look ___ you haven't slept for days.", opts: ["like", "as", "as if"], a: 2, why: "Перед предложением — as if / as though (или разговорно like)." },
      { q: "That sounds ___ a great idea.", opts: ["like", "as if", "—"], a: 0, why: "Перед существительным — like." },
      { q: "I ___ smell something burning.", opts: ["can", "am", "do"], a: 0, why: "С глаголами восприятия часто can: I can smell…" },
      { q: "I saw the thief ___ out of the window and run away.", opts: ["to climb", "climb", "climbed"], a: 1, why: "See + объект + глагол без to — действие целиком." },
      { q: "As I walked past, I heard them ___ (argue).", a: ["arguing"], hint: "форма глагола", why: "Hear + объект + -ing — слышал часть процесса." },
      { q: "He looks ___ his father.", a: ["like"], hint: "1 слово", why: "Look like + существительное — похож." },
      { q: "This material feels ___ silk.", opts: ["like", "as", "as if"], a: 0, why: "Feel like + существительное." },
      { q: "She ___ to be very busy these days.", a: ["seems", "appears"], hint: "1 слово", why: "Seem to be — производит впечатление." },
      { q: "The music sounds really ___ .", opts: ["loudly", "loud", "as loud"], a: 1, why: "Sound + прилагательное." },
    ],
  },
  {
    id: "gerund-infinitive", unit: "8A", title: "Gerunds and infinitives", ru: "Герундий и инфинитив: remember / try / stop / regret, perfect и passive формы",
    explain: `
      <h4>Когда -ing</h4>
      <p>Как подлежащее (<i>Swimming is good for you</i>), после предлогов (<i>good at cooking, before leaving</i>) и после <i>enjoy, avoid, mind, deny, consider, can't stand, look forward to, be used to, it's worth, there's no point in</i>.</p>
      <h4>Когда to + глагол</h4>
      <p>Цель, после прилагательных (<i>easy to use</i>) и после <i>decide, hope, manage, refuse, afford, seem, pretend, tend, would like</i>.</p>
      <h4>Меняется смысл</h4>
      <ul>
        <li><b>remember / forget doing</b> — помнить, что делал; <b>to do</b> — не забыть сделать: <span class="ex">Remember to lock the door.</span></li>
        <li><b>try doing</b> — попробовать как способ; <b>try to do</b> — постараться (трудно): <span class="ex">Try restarting it.</span></li>
        <li><b>stop doing</b> — перестать; <b>stop to do</b> — остановиться, чтобы…</li>
        <li><b>regret doing</b> — жалеть о сделанном; <b>regret to inform</b> — с сожалением сообщить.</li>
        <li><b>need doing</b> = нужно сделать (пассивный смысл): <span class="ex">The car needs washing.</span></li>
        <li><b>go on doing</b> — продолжать; <b>go on to do</b> — затем перейти к другому.</li>
      </ul>
      <h4>Perfect и passive формы</h4>
      <p><b>having done / to have done</b> — раньше: <span class="ex">He denied having taken it.</span> <span class="ex">She seems to have forgotten.</span> <b>being done / to be done</b> — пассив: <span class="ex">I hate being told what to do.</span> <span class="ex">He expects to be promoted.</span></p>`,
    ex: [
      { q: "Did you remember ___ the tickets? We need them tonight!", opts: ["buying", "to buy", "buy"], a: 1, why: "Remember to do — не забыть сделать." },
      { q: "I'll never forget ___ the Grand Canyon for the first time.", opts: ["seeing", "to see", "see"], a: 0, why: "Forget doing — о воспоминании." },
      { q: "If you can't sleep, try ___ a warm drink before bed.", opts: ["having", "to have", "have"], a: 0, why: "Try doing — попробовать как способ." },
      { q: "We stopped ___ some petrol on the way.", opts: ["getting", "to get", "get"], a: 1, why: "Stop to do — остановиться, чтобы сделать." },
      { q: "It's not worth ___ (wait) — the shop won't open today.", a: ["waiting"], hint: "форма глагола", why: "It's worth + -ing." },
      { q: "The suspect denied ___ (be) at the scene.", a: ["being", "having been"], hint: "1–2 слова", why: "Deny + -ing (или perfect -ing: having been)." },
      { q: "I hate ___ (tell) what to do.", a: ["being told"], hint: "2 слова", why: "Пассивный герундий: being + 3-я форма." },
      { q: "The windows need ___ .", opts: ["cleaning", "to clean", "clean"], a: 0, why: "Need + -ing = нужно, чтобы их помыли." },
      { q: "He seems ___ his keys again.", opts: ["to lose", "to have lost", "having lost"], a: 1, why: "Раньше момента речи → to have + 3-я форма." },
      { q: "I'm really looking forward to ___ (see) you.", a: ["seeing"], hint: "форма глагола", why: "Look forward to — здесь to предлог, дальше -ing." },
    ],
  },
  {
    id: "future", unit: "8B", title: "Expressing future plans and arrangements", ru: "Планы и договорённости: going to, Present Continuous, will be doing, be due to…",
    explain: `
      <h4>Основные формы</h4>
      <ul>
        <li><b>Present continuous</b> — договорённость (время и место решены): <span class="ex">I'm meeting Anna at six.</span></li>
        <li><b>going to</b> — намерение, решение уже принято: <span class="ex">I'm going to tell him the truth.</span> Если это только намерение — не Present Continuous.</li>
        <li><b>Future continuous (will be doing)</b> — то, что произойдёт «само собой», в обычном порядке; а также вежливый вопрос о планах: <span class="ex">I'll be passing the post office — shall I post it?</span> <span class="ex">Will you be using the car tonight?</span></li>
        <li><b>Present simple</b> — расписание: <span class="ex">The train leaves at 7:15.</span></li>
      </ul>
      <h4>Другие способы</h4>
      <ul>
        <li><b>be due to</b> — по расписанию/плану: <span class="ex">The plane is due to land at noon.</span></li>
        <li><b>be about to / be on the point of + -ing</b> — вот-вот: <span class="ex">Hurry, the film is about to start.</span></li>
        <li><b>be to</b> — официальные планы (новости): <span class="ex">The President is to visit Brazil.</span></li>
        <li><b>be planning / thinking of + -ing</b>, <b>be hoping to</b>: <span class="ex">We're thinking of moving.</span></li>
      </ul>`,
    ex: [
      { q: "I can't come on Friday — I ___ my grandparents. It's all arranged.", opts: ["visit", "am visiting", "will visit"], a: 1, why: "Договорённость → present continuous." },
      { q: "I've decided. I ___ learn to drive this year.", opts: ["am going to", "am learning to", "will be"], a: 0, why: "Намерение, решение принято → going to." },
      { q: "Our flight ___ at 6:40 tomorrow morning.", opts: ["leaves", "is leaving to", "will leaving"], a: 0, why: "Расписание → present simple." },
      { q: "The new bridge is ___ to open next month.", a: ["due"], hint: "1 слово", why: "Be due to — по плану/расписанию." },
      { q: "Quick! The bus is ___ to leave.", a: ["about"], hint: "1 слово", why: "Be about to — вот-вот." },
      { q: "___ you be using the printer this afternoon? I need it.", opts: ["Are", "Will", "Do"], a: 1, why: "Вежливый вопрос о планах — future continuous: Will you be using…?" },
      { q: "Don't call at eight — we ___ dinner then.", opts: ["will have", "will be having", "have"], a: 1, why: "Действие в процессе в момент в будущем → will be + -ing." },
      { q: "The Prime Minister ___ to meet the Chinese president next week.", opts: ["is", "will", "goes"], a: 0, why: "Be to — официальные планы (новостной стиль)." },
      { q: "We're thinking ___ (buy) a house in the country.", a: ["of buying", "about buying"], hint: "2 слова", why: "Be thinking of / about + -ing." },
      { q: "I'll ___ (see) Mark at work anyway, so I'll give him the message.", a: ["be seeing"], hint: "2 слова", why: "Произойдёт в обычном порядке → will be + -ing." },
    ],
  },
  {
    id: "ellipsis", unit: "9A", title: "Ellipsis and substitution", ru: "Эллипсис и замена: пропуск повторов, so / not, do / did",
    explain: `
      <h4>Пропуск подлежащего и вспомогательного</h4>
      <p>После <b>and, but, or, then</b> повтор можно опустить: <span class="ex">She got up and (she) made coffee.</span> После <b>because, when, while, before, after</b> — нельзя: <span class="ex">I was tired because I had worked late.</span></p>
      <h4>Пропуск глагольной группы</h4>
      <ul>
        <li>Оставляем только вспомогательный или модальный: <span class="ex">I haven't been to Peru, but my brother has.</span> <span class="ex">I'd help if I could.</span></li>
        <li>Для present / past simple — <b>do / does / did</b>: <span class="ex">I didn't like it, but Sam did.</span></li>
        <li>Оставляем <b>to</b> вместо инфинитива: <span class="ex">I'd love to.</span> <span class="ex">I told them not to.</span></li>
      </ul>
      <h4>Замена: so / not</h4>
      <ul>
        <li><b>think, hope, expect, suppose, guess, be afraid + so</b>: <span class="ex">Will it rain? — I hope not.</span> <span class="ex">I think so.</span></li>
        <li>Отрицание: <i>I don't think so</i> (с think, expect), но <i>I hope not / I'm afraid not</i> (не «I don't hope so»).</li>
        <li><b>So do I / Neither do I</b>, <b>So it is!</b> — согласие/удивление.</li>
      </ul>`,
    ex: [
      { q: "I don't eat meat, but my sister ___ .", a: ["does"], hint: "1 слово", why: "Замена глагола в present simple — does." },
      { q: "I've never been skiing, but I'd love ___ .", opts: ["to", "it", "doing"], a: 0, why: "Оставляем to вместо инфинитива: I'd love to." },
      { q: "Is the shop still open? — I'm afraid ___ .", opts: ["not", "no", "don't"], a: 0, why: "I'm afraid not — отрицательная замена." },
      { q: "Will the train be late? — I don't think ___ .", a: ["so"], hint: "1 слово", why: "I don't think so." },
      { q: "She said she'd call, but she ___ .", a: ["didn't", "hasn't", "did not", "has not"], hint: "1–2 слова", why: "Оставляем только вспомогательный." },
      { q: "We should leave now ___ we'll miss the start.", opts: ["or", "and", "because"], a: 0, why: "«Иначе» — or; после and/but/or повтор подлежащего можно пропустить." },
      { q: "I can't come tonight, but I wish I ___ .", opts: ["could", "can", "would"], a: 0, why: "Wish + could, без повтора глагола." },
      { q: "Are you coming to the party? — I hope ___ !", a: ["so"], hint: "1 слово", why: "I hope so." },
      { q: "I asked him not to tell anyone, but he ___ .", opts: ["did", "told", "has"], a: 0, why: "Did заменяет told anyone." },
      { q: "I love jazz. — So ___ I!", a: ["do"], hint: "1 слово", why: "So do I — согласие с утверждением в present simple." },
    ],
  },
  {
    id: "nouns", unit: "9B", title: "Nouns: compound and possessive forms", ru: "Сложные существительные и притяжательные формы: a coffee cup или a cup of coffee, 's или of",
    explain: `
      <h4>Сложные существительные</h4>
      <ul>
        <li>Первое существительное работает как прилагательное и стоит в <b>единственном числе</b>: <span class="ex">a shoe shop</span>, <span class="ex">a ten-minute walk</span> (не «ten-minutes»).</li>
        <li>Пишутся раздельно, слитно или через дефис — проверяй в словаре: <i>bus stop, toothbrush, mother-in-law</i>.</li>
        <li><b>a wine glass</b> — бокал для вина (тип); <b>a glass of wine</b> — бокал с вином (содержимое).</li>
      </ul>
      <h4>'s или of</h4>
      <ul>
        <li><b>'s</b> — с людьми и животными: <span class="ex">my sister's car</span>, <span class="ex">the dog's bed</span>. Множественное на -s — только апостроф: <span class="ex">my parents' house</span>.</li>
        <li><b>'s</b> — с организациями, странами и временем: <span class="ex">the company's profits</span>, <span class="ex">yesterday's news</span>, <span class="ex">a week's holiday</span>.</li>
        <li><b>of</b> — с предметами и частями: <span class="ex">the end of the film</span>, <span class="ex">the top of the hill</span>.</li>
        <li>'s без существительного — магазин или дом: <span class="ex">at the doctor's</span>, <span class="ex">at Anna's</span>.</li>
        <li>Двойное притяжательное: <span class="ex">a friend of my brother's</span>.</li>
      </ul>`,
    ex: [
      { q: "It's only a ___ walk to the station.", opts: ["five-minutes", "five-minute", "five minute's"], a: 1, why: "В сложном прилагательном существительное в единственном числе." },
      { q: "Could you pass me a ___ ? I'm thirsty.", opts: ["water glass", "glass of water", "glass's water"], a: 1, why: "Нужна вода (содержимое) — a glass of water." },
      { q: "We're spending the weekend at my ___ house.", opts: ["parents'", "parent's", "parents's"], a: 0, why: "Множественное число на -s → только апостроф: parents'." },
      { q: "I didn't understand the end ___ the film.", a: ["of"], hint: "1 слово", why: "Части предметов — of." },
      { q: "Have you read ___ newspaper?", opts: ["today's", "the today", "of today"], a: 0, why: "Время — 's: today's newspaper." },
      { q: "She's a friend of my ___ .", opts: ["brother", "brother's", "brothers"], a: 1, why: "Двойное притяжательное: a friend of my brother's." },
      { q: "I've got an appointment at the ___ tomorrow.", opts: ["dentist's", "dentist", "dentists'"], a: 0, why: "'s без существительного = место (the dentist's [office])." },
      { q: "The ___ success surprised everyone.", opts: ["company's", "company of", "companies"], a: 0, why: "Организации — 's." },
      { q: "We need a new ___ — this one's broken.", opts: ["can opener", "cans opener", "opener of cans"], a: 0, why: "Сложное существительное: первое слово в единственном числе." },
      { q: "My ___ car is much bigger than mine.", opts: ["children's", "childrens'", "childs'"], a: 0, why: "Неправильное множественное без -s → 's: children's." },
    ],
  },
  {
    id: "cleft", unit: "10A", title: "Adding emphasis (2): cleft sentences", ru: "Выделение: What I need is…, It was … who…, All I did was…",
    explain: `
      <p>Расщеплённые предложения переносят акцент на нужную часть — в устной речи и для контраста.</p>
      <h4>What … is / was</h4>
      <p><span class="ex">I need a holiday.</span> → <span class="ex">What I need is a holiday.</span> Действие — с <b>do</b>: <span class="ex">What he did was (to) call the police.</span> Также <b>The thing that / The reason why / The person who / The place where</b>: <span class="ex">The reason why I left was the salary.</span></p>
      <h4>All … is / was</h4>
      <p>«Только, всего лишь»: <span class="ex">All I want is some peace and quiet.</span> <span class="ex">All I did was ask a question!</span></p>
      <h4>It is / was … that / who</h4>
      <p>Выделяем любую часть: <span class="ex">It was Tom who broke it (not me).</span> <span class="ex">It was in 2010 that we met.</span> <span class="ex">It's the noise that I can't stand.</span></p>
      <h4>Другие способы усиления</h4>
      <p><b>do / does / did</b> в утверждении: <span class="ex">I did tell you!</span> <span class="ex">She does look tired.</span></p>`,
    ex: [
      { q: "___ I really want is a cup of tea.", opts: ["That", "What", "Which"], a: 1, why: "What I want is…" },
      { q: "It was my brother ___ told me the news.", opts: ["which", "who", "what"], a: 1, why: "It was + человек + who / that." },
      { q: "All I did ___ ask her a simple question!", a: ["was"], hint: "1 слово", why: "All I did was + глагол." },
      { q: "What she did ___ to call a lawyer.", opts: ["was", "did", "is"], a: 0, why: "What she did was (to) + глагол." },
      { q: "It was in Rome ___ they first met.", opts: ["where", "that", "which"], a: 1, why: "It was + обстоятельство + that." },
      { q: "The reason ___ I'm calling is to apologize.", opts: ["why", "what", "because"], a: 0, why: "The reason why … is…" },
      { q: "I ___ tell you about the meeting — you just forgot!", a: ["did"], hint: "1 слово", why: "Усилительное did в утверждении." },
      { q: "What annoys me ___ the way he talks to people.", opts: ["is", "it is", "are"], a: 0, why: "What annoys me is…" },
      { q: "___ we need now is more time.", opts: ["All", "Everything that", "It"], a: 0, why: "All we need is… — «нам нужно только»." },
      { q: "It isn't the money ___ worries me, it's the time.", opts: ["that", "what", "who"], a: 0, why: "It isn't X that…, it's Y." },
    ],
  },
  {
    id: "comparison", unit: "10B", title: "Comparison", ru: "Сравнение: as … as, twice as, much / far / slightly, the more… the more",
    explain: `
      <h4>as … as</h4>
      <ul>
        <li>Равенство: <span class="ex">She's as tall as me / as I am.</span> С модификаторами: <i>just / nearly / almost / not quite / not nearly / nowhere near / half</i>: <span class="ex">It's not nearly as good as the book.</span></li>
        <li>Во сколько раз: <span class="ex">twice / three times as expensive as</span>. С three times можно и сравнительную степень: <i>three times more expensive than</i>, но <b>twice</b> — только <i>twice as … as</i>.</li>
        <li><b>as much / as many</b>: <span class="ex">He earns twice as much as I do.</span></li>
      </ul>
      <h4>Модификаторы сравнительной степени</h4>
      <ul>
        <li>Сильно: <b>much, far, a lot, considerably, way</b> (разг.): <span class="ex">far more expensive</span>.</li>
        <li>Немного: <b>a little, slightly, a bit</b>: <span class="ex">slightly cheaper</span>.</li>
        <li><b>much more</b> + неисчисляемое, <b>many more</b> + исчисляемое: <span class="ex">many more people</span>.</li>
        <li>С превосходной: <b>by far, easily</b>: <span class="ex">by far the best</span>.</li>
      </ul>
      <h4>Особые конструкции</h4>
      <ul>
        <li><b>the + сравнительная, the + сравнительная</b>: <span class="ex">The sooner, the better.</span> <span class="ex">The more you practice, the easier it gets.</span></li>
        <li><b>сравнительная and сравнительная</b> — всё больше и больше: <span class="ex">It's getting harder and harder.</span></li>
      </ul>`,
    ex: [
      { q: "Our new flat is twice ___ big as the old one.", a: ["as"], hint: "1 слово", why: "Twice as … as." },
      { q: "This phone is ___ better than my old one.", opts: ["very", "far", "too"], a: 1, why: "Усиление сравнительной степени — far / much / a lot (не very)." },
      { q: "The film wasn't ___ as good as I'd expected.", opts: ["nearly", "much", "far"], a: 0, why: "Not nearly as … as — далеко не такой…" },
      { q: "There are ___ more cars on the road than ten years ago.", opts: ["much", "many", "more"], a: 1, why: "Many more + исчисляемое множественное." },
      { q: "She's ___ the best player on the team.", opts: ["by far", "far more", "very"], a: 0, why: "By far + превосходная степень." },
      { q: "The ___ you practice, the better you'll get.", a: ["more"], hint: "1 слово", why: "The more…, the better…" },
      { q: "It's getting more and ___ difficult to find a cheap flat.", a: ["more"], hint: "1 слово", why: "More and more difficult — всё труднее и труднее." },
      { q: "The later train is ___ cheaper — only a dollar less.", opts: ["slightly", "far", "by far"], a: 0, why: "Немного — slightly / a little / a bit." },
      { q: "He earns three times as ___ as I do.", a: ["much"], hint: "1 слово", why: "Деньги — неисчисляемое: as much as." },
      { q: "The ___ the better — we need it by Friday.", a: ["sooner"], hint: "1 слово", why: "The sooner, the better." },
    ],
  },
]);
