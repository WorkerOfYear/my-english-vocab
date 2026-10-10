// Grammar rules, units 1–5. The order and topics follow the grammar syllabus of American English File 5
// (Student Book contents, units 1A–10B); explanations and exercises are written for this app.
// Exercise types:
//   { q: "text with ___", opts: [...], a: index, why }        — choose the right option
//   { q: "text with ___", a: ["answer", "variant"], hint, why } — type the missing words
window.GRAMMAR = (window.GRAMMAR || []).concat([
  {
    id: "connectors", unit: "1A", title: "Discourse markers (1): connectors", ru: "Связки: контраст, причина, цель, результат",
    explain: `
      <h4>Контраст</h4>
      <ul>
        <li><b>but / yet</b> — внутри предложения. <i>Yet</i> звучит книжнее: <span class="ex">The plan was simple, yet it worked.</span></li>
        <li><b>However / Nevertheless</b> — в начале нового предложения, после них запятая: <span class="ex">The hotel was old. However, the rooms were spotless.</span></li>
        <li><b>although / even though / though</b> + полное предложение (подлежащее + глагол). <i>Even though</i> — сильнее, <i>though</i> — разговорнее и может стоять в конце: <span class="ex">It was a good trip — a bit expensive, though.</span></li>
        <li><b>despite / in spite of</b> + существительное или <b>-ing</b>, либо <b>the fact that</b> + предложение: <span class="ex">Despite feeling tired, she kept going.</span> <span class="ex">In spite of the fact that it was late, we stayed.</span></li>
      </ul>
      <h4>Причина и результат</h4>
      <ul>
        <li><b>because / as / since</b> + предложение; <b>because of / due to / owing to</b> + существительное: <span class="ex">The flight was delayed due to fog.</span></li>
        <li><b>so / therefore / as a result / consequently</b> — результат. <i>Therefore</i> и <i>consequently</i> — формальные.</li>
      </ul>
      <h4>Цель</h4>
      <ul>
        <li><b>to / in order to / so as to</b> + глагол: <span class="ex">I left early so as to avoid the traffic.</span> Отрицание: <b>so as not to / in order not to</b> (не «not to» отдельно в формальной речи).</li>
        <li><b>so that</b> + предложение (часто с can / could / would): <span class="ex">I'll text you so that you know where we are.</span></li>
        <li><b>in case</b> — «на случай, если»: <span class="ex">Take an umbrella in case it rains.</span> (не «if»).</li>
      </ul>`,
    ex: [
      { q: "___ the heavy traffic, we arrived on time.", opts: ["Although", "Despite", "However"], a: 1, why: "После despite — существительное (the heavy traffic), а although требует полного предложения." },
      { q: "The film got terrible reviews. ___, it made a fortune at the box office.", opts: ["Nevertheless", "Even though", "Despite"], a: 0, why: "В начале нового предложения с запятой — however / nevertheless." },
      { q: "She took the job ___ the salary was quite low.", opts: ["in spite of", "even though", "due to"], a: 1, why: "Дальше идёт полное предложение (the salary was…), значит нужен союз even though." },
      { q: "I wrote the address down ___ forget it.", a: ["so as not to", "in order not to"], hint: "цель, отрицание, 3–4 слова", why: "Отрицательная цель: so as not to / in order not to + глагол." },
      { q: "Pack a sweater ___ it gets cold in the evening.", opts: ["if", "in case", "so that"], a: 1, why: "In case — «на случай, если»: берём заранее, на всякий случай." },
      { q: "The match was cancelled ___ the storm.", opts: ["because", "due to", "so as"], a: 1, why: "Due to / because of + существительное; because + предложение." },
      { q: "In spite ___ the fact that he was ill, he went to work.", a: ["of"], hint: "1 слово", why: "In spite of the fact that + предложение." },
      { q: "I'm saving money ___ I can travel next summer.", opts: ["so that", "in order to", "in case"], a: 0, why: "So that + предложение с can; in order to требует глагола сразу после." },
      { q: "Despite ___ (study) hard, he failed the exam.", a: ["studying"], hint: "форма глагола", why: "После despite / in spite of глагол идёт с -ing." },
      { q: "The road was icy. ___, several cars slid off it.", opts: ["As a result", "Even though", "So as"], a: 0, why: "As a result в начале предложения вводит следствие." },
    ],
  },
  {
    id: "have", unit: "1B", title: "have", ru: "Глагол have: владение, действие, вспомогательный, have something done",
    explain: `
      <h4>have — владение (stative)</h4>
      <p>Не используется в Continuous; вопросы и отрицания через <b>do / did</b>: <span class="ex">Do you have a car?</span> <span class="ex">I didn't have time.</span> Разговорно — <b>have got</b> (только в настоящем): <span class="ex">I've got two sisters.</span> В прошедшем — просто <b>had</b>, не «had got».</p>
      <h4>have + существительное — действие (dynamic)</h4>
      <p><i>have lunch, a shower, a meeting, a good time, a chat</i> — можно в Continuous: <span class="ex">We're having dinner, can I call you back?</span></p>
      <h4>have — вспомогательный</h4>
      <p>Present / past perfect: вопрос через инверсию, отрицание <b>haven't / hasn't</b>: <span class="ex">How long have you been living here?</span></p>
      <h4>have / get something done</h4>
      <p>Кто-то делает это для вас: <b>have + объект + 3-я форма</b>. <i>Get</i> звучит естественнее в разговоре: <span class="ex">I'm having my car serviced tomorrow.</span> <span class="ex">Where do you get your hair cut?</span> Так же говорят о неприятностях: <span class="ex">She had her phone stolen.</span></p>
      <h4>have to / have got to</h4>
      <p><b>have to</b> — обязанность, часто внешняя (правила). Вопрос: <span class="ex">Do you have to wear a uniform?</span> <b>have got to</b> — разговорно, для конкретного случая: <span class="ex">I've got to go — my bus is coming.</span> В вопросах обычно <i>do you have to</i>, а не «have you got to».</p>`,
    ex: [
      { q: "Sorry, I can't talk now — we ___ a meeting.", opts: ["have", "are having", "have got"], a: 1, why: "Have a meeting — действие, в процессе прямо сейчас → Continuous." },
      { q: "___ you have any brothers or sisters?", opts: ["Have", "Do", "Are"], a: 1, why: "Have (владение/родство) — смысловой глагол, вопрос через do." },
      { q: "When I was a child, I ___ a dog called Max.", opts: ["had got", "had", "was having"], a: 1, why: "В прошедшем для владения просто had; «had got» так не используется." },
      { q: "I need to have my eyes ___ (test).", a: ["tested"], hint: "форма глагола", why: "Have + объект + 3-я форма: have my eyes tested." },
      { q: "She ___ her bag stolen on the subway last week.", a: ["had", "got"], hint: "1 слово", why: "Had / got something done — и для неприятностей, которые с вами случились." },
      { q: "How long ___ you been working here?", opts: ["do", "have", "are"], a: 1, why: "Present perfect continuous: have + been + -ing, вопрос через инверсию have." },
      { q: "___ you have to work this weekend?", opts: ["Have", "Do", "Have got"], a: 1, why: "В вопросах с have to используют do: Do you have to…?" },
      { q: "We ___ the house painted last spring — it looks great.", a: ["had", "got"], hint: "1 слово", why: "Мы не красили сами — had / got the house painted." },
      { q: "I haven't ___ any money on me. Can you pay?", a: ["got"], hint: "1 слово", why: "Have got в отрицании: I haven't got = I don't have." },
      { q: "Are you ___ fun? You look bored!", a: ["having"], hint: "1 слово", why: "Have fun — действие, в Continuous: Are you having fun?" },
    ],
  },
  {
    id: "pronouns", unit: "2A", title: "Pronouns", ru: "Местоимения: обобщённые, возвратные, взаимные, it / there",
    explain: `
      <h4>Обобщённые местоимения (люди вообще)</h4>
      <ul>
        <li><b>you</b> — самый обычный вариант: <span class="ex">You never know what will happen.</span></li>
        <li><b>one</b> — формально и редко в речи: <span class="ex">One should always read the small print.</span></li>
        <li><b>we</b> — включает читателя/слушателя; <b>they</b> — «люди говорят» или власти: <span class="ex">They say it's going to snow.</span> <span class="ex">They're building a new bridge.</span></li>
        <li><b>they / them / their</b> — об одном человеке, пол которого неизвестен: <span class="ex">If anyone calls, tell them I'm out.</span></li>
      </ul>
      <h4>Возвратные (-self) и взаимные</h4>
      <ul>
        <li>Когда подлежащее и дополнение — одно лицо: <span class="ex">He taught himself to code.</span></li>
        <li>Не используем с <i>wash, shave, dress, feel, relax, concentrate</i>: <span class="ex">Just relax.</span> (не «relax yourself»).</li>
        <li>После предлогов места — обычные местоимения: <span class="ex">She put the bag next to her.</span></li>
        <li>Для усиления: <span class="ex">We built it ourselves.</span> <b>by myself</b> = один, без помощи.</li>
        <li><b>each other / one another</b> — друг друга. Сравни: <i>They bought themselves presents</i> (каждый себе) и <i>They bought each other presents</i> (друг другу).</li>
      </ul>
      <h4>it и there</h4>
      <ul>
        <li><b>it</b> — время, погода, расстояние, и как «формальное» подлежащее: <span class="ex">It's great to see you.</span> <span class="ex">It's 20 miles to the coast.</span></li>
        <li><b>there + be</b> — что-то есть / существует: <span class="ex">There used to be a cinema here.</span> (не «It used to be a cinema» в этом смысле).</li>
      </ul>`,
    ex: [
      { q: "___ say that the new mayor is going to raise taxes.", opts: ["They", "One", "It"], a: 0, why: "They say — «говорят», люди вообще." },
      { q: "If a student is late, ___ must report to the office.", opts: ["he or she", "they", "one"], a: 1, why: "They — естественный вариант для одного человека неизвестного пола." },
      { q: "I can't concentrate ___ with all this noise.", opts: ["myself", "—", "me"], a: 1, why: "Concentrate, relax, feel — без возвратного местоимения." },
      { q: "She looked behind ___ but nobody was there.", opts: ["herself", "her", "her own"], a: 1, why: "После предлога места — обычное местоимение (behind her)." },
      { q: "We didn't hire anyone — we painted the flat ___.", a: ["ourselves"], hint: "1 слово", why: "Возвратное для усиления: сделали сами." },
      { q: "The two neighbors haven't spoken to ___ for years.", a: ["each other", "one another"], hint: "2 слова", why: "Взаимное действие — each other / one another." },
      { q: "___ 's no point in arguing about it.", opts: ["It", "There"], a: 1, why: "There's no point in -ing — устойчивая конструкция с there." },
      { q: "___ 's a long way from here to the airport.", opts: ["It", "There"], a: 0, why: "Расстояние — с it." },
      { q: "___ used to be a bakery on this corner.", opts: ["It", "There"], a: 1, why: "Существование чего-то — there used to be." },
      { q: "Don't worry, you can do it by ___.", a: ["yourself"], hint: "1 слово", why: "By yourself — сам, без помощи." },
    ],
  },
  {
    id: "past", unit: "2B", title: "The past: narrative tenses, used to, and would", ru: "Прошлое: времена рассказа, used to и would",
    explain: `
      <h4>Конкретный эпизод — narrative tenses</h4>
      <ul>
        <li><b>Past simple</b> — основные события по порядку: <span class="ex">I opened the door and saw…</span></li>
        <li><b>Past continuous</b> — фон, действие в процессе: <span class="ex">It was raining and people were hurrying home.</span></li>
        <li><b>Past perfect</b> — то, что случилось раньше основных событий: <span class="ex">The train had already left when we arrived.</span></li>
        <li><b>Past perfect continuous</b> — длительное действие до момента в прошлом: <span class="ex">Her eyes were red — she had been crying.</span></li>
      </ul>
      <h4>Повторявшееся в прошлом — used to / would</h4>
      <ul>
        <li><b>used to</b> + глагол — привычки и <b>состояния</b>, которых больше нет: <span class="ex">I used to have long hair.</span> Отрицание: <i>didn't use to</i>.</li>
        <li><b>would</b> + глагол — только повторяющиеся <b>действия</b>, не состояния: <span class="ex">Every summer we would go fishing.</span> Но не «I would have long hair».</li>
        <li><b>always + past continuous</b> — раздражающая привычка: <span class="ex">He was always borrowing my things.</span></li>
      </ul>
      <p>В рассказе о прошлом их обычно смешивают с past simple, чтобы не повторяться; used to и would добавляют оттенок ностальгии.</p>`,
    ex: [
      { q: "When I got to the station, the train ___ .", opts: ["left", "had left", "was leaving"], a: 1, why: "Поезд ушёл раньше, чем я пришёл → past perfect." },
      { q: "I ___ a shower when the phone rang.", opts: ["had", "was having", "had had"], a: 1, why: "Действие в процессе, которое прервали → past continuous." },
      { q: "When I was a kid, I ___ freckles.", opts: ["used to have", "would have", "was having"], a: 0, why: "Состояние (have freckles) → только used to, не would." },
      { q: "Every evening my grandfather ___ tell us stories.", opts: ["would", "was", "had"], a: 0, why: "Повторяющееся действие в прошлом → would + глагол." },
      { q: "She was out of breath because she ___ (run).", a: ["had been running"], hint: "3 слова", why: "Длительное действие до момента в прошлом → past perfect continuous." },
      { q: "I ___ (not / use) to like vegetables, but now I love them.", a: ["didn't", "did not"], hint: "1–2 слова", why: "Отрицание: didn't use to." },
      { q: "My brother ___ my clothes without asking — it drove me crazy!", opts: ["was always borrowing", "had always borrowed", "would always borrowed"], a: 0, why: "Always + past continuous — раздражающая привычка." },
      { q: "We ___ in Spain for three years before we moved to Mexico.", opts: ["had lived", "were living", "would live"], a: 0, why: "Период до другого события в прошлом → past perfect." },
      { q: "While we ___ dinner, the lights went out.", opts: ["had", "were having", "had had"], a: 1, why: "Фон, прерванный событием → past continuous." },
      { q: "There ___ to be a cinema here, but they knocked it down.", a: ["used"], hint: "1 слово", why: "There used to be — что-то существовало раньше." },
    ],
  },
  {
    id: "get", unit: "3A", title: "get", ru: "Глагол get: получить, стать, заставить, get something done, пассив с get",
    explain: `
      <h4>get + существительное</h4>
      <p>«получить, купить, достать, принести, поймать»: <span class="ex">Can you get some milk on the way home?</span> <b>get to</b> + место = добраться: <span class="ex">What time did you get to London?</span></p>
      <h4>get + прилагательное = становиться</h4>
      <p><span class="ex">It's getting dark.</span> <span class="ex">Prices keep getting higher.</span> <b>get used to</b> + -ing — привыкать: <span class="ex">I'm getting used to working from home.</span></p>
      <h4>get + человек + to do = убедить, заставить</h4>
      <p><span class="ex">I finally got him to apologize.</span> (Сравни с <i>make him apologize</i> — без to.)</p>
      <h4>get + предмет + 3-я форма = get something done</h4>
      <p>Разговорная замена have something done: <span class="ex">I need to get my passport renewed.</span></p>
      <h4>get + 3-я форма = пассив</h4>
      <p>Разговорно, часто о неожиданном или неприятном: <span class="ex">He got fired.</span> <span class="ex">We got stuck in traffic.</span> <span class="ex">Did you get invited?</span></p>`,
    ex: [
      { q: "It's ___ late — we should go home.", a: ["getting"], hint: "1 слово", why: "Get + прилагательное = становиться." },
      { q: "I can't ___ used to the cold weather here.", a: ["get"], hint: "1 слово", why: "Get used to — привыкать." },
      { q: "How can I get my parents ___ me go to the concert?", opts: ["let", "to let", "letting"], a: 1, why: "Get somebody to do — с частицей to." },
      { q: "I'm getting my hair ___ (cut) tomorrow.", a: ["cut"], hint: "форма глагола", why: "Get something done: get my hair cut." },
      { q: "He ___ caught cheating in the exam.", a: ["got"], hint: "1 слово", why: "Пассив с get: got caught." },
      { q: "We got ___ (lose) in the old town and missed the bus.", a: ["lost"], hint: "форма глагола", why: "Get lost — заблудиться (get + 3-я форма)." },
      { q: "What time do you usually get ___ work?", opts: ["at", "to", "in"], a: 1, why: "Get to + место = добраться." },
      { q: "She got ___ (promote) after only a year.", a: ["promoted"], hint: "форма глагола", why: "Пассив с get: got promoted." },
      { q: "Could you get the kids ___ their teeth?", opts: ["brush", "to brush", "brushed"], a: 1, why: "Get somebody to do something." },
      { q: "I need to get my car ___ — it's making a strange noise.", opts: ["repair", "to repair", "repaired"], a: 2, why: "Get something done: get my car repaired." },
    ],
  },
  {
    id: "adverbs", unit: "3B", title: "Discourse markers (2): adverbs and adverbial expressions", ru: "Связки в речи: anyway, after all, at least, as I was saying…",
    explain: `
      <p>Эти слова помогают управлять разговором: сменить тему, вернуться к ней, смягчить или усилить сказанное.</p>
      <ul>
        <li><b>by the way / incidentally</b> — сменить тему или вспомнить что-то: <span class="ex">By the way, did you call Mom?</span></li>
        <li><b>anyway / in any case</b> — вернуться к главному или «как бы то ни было»: <span class="ex">Anyway, as I was saying…</span></li>
        <li><b>as I was saying</b> — вернуться к теме после того, как перебили.</li>
        <li><b>actually / as a matter of fact / in fact</b> — неожиданная или уточняющая информация: <span class="ex">Actually, I've never been to Paris.</span></li>
        <li><b>at least</b> — хоть что-то хорошее после плохого: <span class="ex">We lost, but at least we scored.</span> Также — смягчить: <span class="ex">He's at home — at least, I think he is.</span></li>
        <li><b>after all</b> — сильный довод, о котором собеседник мог забыть: <span class="ex">Let him go — after all, he's eighteen.</span></li>
        <li><b>otherwise</b> — «иначе»: <span class="ex">Hurry, otherwise we'll miss it.</span></li>
        <li><b>I mean</b> — пояснить или поправить себя. <b>basically</b> — обобщить, сказать главное.</li>
        <li><b>on the whole / all in all</b> — в целом, учитывая всё. <b>talking / speaking of…</b> — раз уж речь зашла о…</li>
        <li><b>obviously</b> — очевидно; <b>apparently</b> — судя по всему, как говорят.</li>
      </ul>`,
    ex: [
      { q: "The hotel was awful. ___, the beach was beautiful.", opts: ["At least", "After all", "By the way"], a: 0, why: "Хоть что-то хорошее после плохого — at least." },
      { q: "Don't be so hard on him. ___, it's only his first week.", opts: ["Otherwise", "After all", "Anyway"], a: 1, why: "Довод, который стоит учесть — after all." },
      { q: "We'd better leave now, ___ we'll get stuck in traffic.", opts: ["otherwise", "in fact", "actually"], a: 0, why: "Otherwise — «иначе»." },
      { q: "___, did you remember to buy the tickets?", opts: ["By the way", "After all", "On the whole"], a: 0, why: "Внезапно вспомнили — by the way." },
      { q: "Sorry, where was I? Oh yes, ___ I was saying, the project is late.", a: ["as"], hint: "1 слово", why: "As I was saying — вернуться к теме." },
      { q: "People think he's rich, but ___ he's in a lot of debt.", opts: ["in fact", "at least", "otherwise"], a: 0, why: "In fact / actually — неожиданная правда." },
      { q: "There were a few problems, but ___ the holiday was a success.", opts: ["on the whole", "by the way", "otherwise"], a: 0, why: "On the whole — в целом." },
      { q: "___ of food, have you tried the new Thai place?", opts: ["Talking", "Saying", "Telling"], a: 0, why: "Talking / speaking of… — раз уж зашла речь." },
      { q: "I'm not sure if she'll come. ___, I'll save her a seat.", opts: ["In any case", "After all", "Basically"], a: 0, why: "In any case / anyway — как бы то ни было." },
      { q: "___, the company is closing — at least that's what I heard.", opts: ["Apparently", "Obviously", "Otherwise"], a: 0, why: "Apparently — «судя по всему, говорят»." },
    ],
  },
  {
    id: "deduction", unit: "4A", title: "Speculation and deduction", ru: "Предположения и выводы: must / might / can't (have), bound to, likely",
    explain: `
      <h4>Модальные глаголы</h4>
      <ul>
        <li><b>must</b> — почти уверен, что да: <span class="ex">She must be at work — her car's gone.</span></li>
        <li><b>might / may / could</b> — возможно: <span class="ex">He might be stuck in traffic.</span></li>
        <li><b>can't / couldn't</b> — уверен, что нет (не «mustn't»): <span class="ex">That can't be Tom — he's in Japan.</span></li>
        <li>О настоящем в процессе: <b>must / might + be + -ing</b>: <span class="ex">They must be having dinner.</span></li>
        <li>О прошлом: <b>modal + have + 3-я форма</b>: <span class="ex">You must have left it on the bus.</span> <span class="ex">She can't have seen us.</span></li>
      </ul>
      <h4>Другие способы</h4>
      <ul>
        <li><b>be bound to / be sure to</b> — точно будет: <span class="ex">It's bound to rain at the weekend.</span></li>
        <li><b>be likely / unlikely to</b>, <b>it's likely that</b>: <span class="ex">He's unlikely to win.</span></li>
        <li><b>I doubt (if/whether)</b>, <b>I bet</b>, <b>there's a chance that</b>.</li>
        <li><b>seem / look / sound like / as if</b>: <span class="ex">It looks as if nobody's home.</span></li>
      </ul>`,
    ex: [
      { q: "The lights are off. They ___ be out.", opts: ["must", "can't", "mustn't"], a: 0, why: "Логичный вывод «да» — must." },
      { q: "That ___ be his sister — she's much too young.", opts: ["mustn't", "can't", "might"], a: 1, why: "Уверенность «нет» — can't, не mustn't." },
      { q: "I can't find my keys. I ___ left them at the office.", a: ["must have", "might have", "may have", "could have"], hint: "2 слова", why: "Предположение о прошлом: modal + have + 3-я форма." },
      { q: "She didn't reply. She ___ (not / get) my message.", a: ["can't have got", "can't have gotten", "couldn't have got", "couldn't have gotten", "might not have got", "might not have gotten", "may not have got", "may not have gotten"], hint: "модальный + have + 3-я форма", why: "Прошлое: can't have / might not have + 3-я форма." },
      { q: "Don't call now — they ___ be having dinner.", opts: ["might", "can't", "must to"], a: 0, why: "Действие в процессе: might / must + be + -ing." },
      { q: "With all this traffic, we're ___ to be late.", opts: ["bound", "likely that", "sure that"], a: 0, why: "Be bound to + глагол — точно будет." },
      { q: "He's very ___ to pass — he hasn't studied at all.", opts: ["unlikely", "bound", "doubtful"], a: 0, why: "Be unlikely to + глагол." },
      { q: "You ___ have been terrified when the plane started shaking!", opts: ["must", "can't", "should"], a: 0, why: "Вывод о прошлом — must have." },
      { q: "It ___ as if it's going to snow.", a: ["looks", "seems"], hint: "1 слово", why: "It looks / seems as if…" },
      { q: "I ___ whether they'll come — it's raining heavily.", a: ["doubt"], hint: "1 слово", why: "I doubt whether / if — сомневаюсь." },
    ],
  },
  {
    id: "inversion", unit: "4B", title: "Adding emphasis (1): inversion", ru: "Инверсия для усиления: Never have I…, Not only…, Hardly… when",
    explain: `
      <p>После отрицательных и ограничительных слов в начале предложения порядок слов становится вопросительным: <b>вспомогательный глагол + подлежащее</b>. Это формальный, книжный стиль — для драматизма и усиления.</p>
      <ul>
        <li><b>Never (before) / Rarely / Seldom</b>: <span class="ex">Never have I seen such chaos.</span></li>
        <li><b>Not only … but (also)</b>: <span class="ex">Not only did he lie, but he also blamed me.</span></li>
        <li><b>Hardly / Scarcely … when</b>, <b>No sooner … than</b> — «едва… как»: <span class="ex">Hardly had we sat down when the phone rang.</span> <span class="ex">No sooner had I left than it started to rain.</span></li>
        <li><b>Not until</b> / <b>Only when / Only after / Only then</b> — инверсия во <b>второй</b> части: <span class="ex">Only when I got home did I realize.</span> <span class="ex">Not until the next day did she call.</span></li>
        <li><b>Under no circumstances / On no account / At no time</b>: <span class="ex">Under no circumstances should you open this door.</span></li>
        <li><b>Little</b> (= совсем не): <span class="ex">Little did they know what was coming.</span></li>
      </ul>
      <p>В настоящем и прошедшем простом нужен <b>do / does / did</b>: <i>Rarely does he…</i>, <i>Not only did she…</i></p>`,
    ex: [
      { q: "Never ___ such a beautiful sunset.", opts: ["I have seen", "have I seen", "I saw"], a: 1, why: "После never в начале — инверсия: have I seen." },
      { q: "Not only ___ late, but he also forgot the tickets.", opts: ["he was", "was he", "did he"], a: 1, why: "Инверсия с be: was he." },
      { q: "Hardly had we arrived ___ it started to rain.", opts: ["than", "when", "that"], a: 1, why: "Hardly … when; а no sooner … than." },
      { q: "No sooner ___ I closed my eyes than the alarm went off.", a: ["had"], hint: "1 слово", why: "No sooner had + подлежащее + 3-я форма … than." },
      { q: "Only when I read the letter ___ I understand.", opts: ["I did", "did I", "I"], a: 1, why: "С only when инверсия во второй части: did I understand." },
      { q: "Under no circumstances ___ you leave the building.", opts: ["should", "you should", "you"], a: 0, why: "Under no circumstances + should you…" },
      { q: "Little ___ she know that her life was about to change.", a: ["did"], hint: "1 слово", why: "Little did she know — книжное «она и не подозревала»." },
      { q: "Rarely ___ he eat breakfast before work.", opts: ["does", "is", "do"], a: 0, why: "Present simple → does he eat." },
      { q: "Not until the end of the film ___ who the killer was.", opts: ["we realized", "did we realize", "we did realize"], a: 1, why: "Not until … — инверсия в главной части: did we realize." },
      { q: "Not only ___ she speak French, she also speaks Arabic.", a: ["does"], hint: "1 слово", why: "Present simple → does she speak." },
    ],
  },
  {
    id: "distancing", unit: "5A", title: "Distancing", ru: "Дистанцирование: seem / appear, It is said that…, is thought to have…",
    explain: `
      <p>Когда мы не хотим утверждать что-то как факт (не уверены, или это чужие слова), используем «дистанцирующие» конструкции. Это типично для новостей и формального письма.</p>
      <h4>seem / appear</h4>
      <ul>
        <li><b>It seems / appears (that)</b> + предложение: <span class="ex">It seems that the meeting has been cancelled.</span></li>
        <li><b>Подлежащее + seem / appear + to</b> + глагол: <span class="ex">He seems to be upset.</span> О прошлом — <b>to have + 3-я форма</b>: <span class="ex">They appear to have left.</span></li>
        <li><b>There seems to be</b>: <span class="ex">There seems to be a problem.</span></li>
        <li><b>It would seem / appear</b> — ещё осторожнее и формальнее.</li>
      </ul>
      <h4>Пассив с глаголами мнения и сообщения</h4>
      <ul>
        <li><b>It is said / thought / believed / reported / expected that</b> + предложение: <span class="ex">It is believed that the fire started in the kitchen.</span></li>
        <li><b>Подлежащее + is said / thought … + to</b> + глагол: <span class="ex">The singer is said to be furious.</span> О прошлом: <span class="ex">He is thought to have escaped abroad.</span> В процессе: <span class="ex">She is believed to be living in Rome.</span></li>
        <li><b>There is / are thought to be</b>: <span class="ex">There are thought to be 200 people trapped.</span></li>
      </ul>
      <p>Смягчители: <i>apparently, according to…, may / might, I would say</i>.</p>`,
    ex: [
      { q: "It ___ that nobody saw the accident.", opts: ["seems", "is seemed", "seems to"], a: 0, why: "It seems that + предложение." },
      { q: "The suspect is believed ___ the country last night.", opts: ["to leave", "to have left", "leaving"], a: 1, why: "Событие в прошлом → to have + 3-я форма." },
      { q: "There ___ to be a mistake on the bill.", a: ["seems", "appears"], hint: "1 слово", why: "There seems / appears to be…" },
      { q: "It ___ said that this house is haunted.", a: ["is"], hint: "1 слово", why: "It is said that…" },
      { q: "The minister is expected ___ (resign) next week.", a: ["to resign"], hint: "2 слова", why: "Is expected to + глагол (будущее/настоящее)." },
      { q: "The company ___ to be in financial trouble.", opts: ["appears", "is appeared", "appear"], a: 0, why: "Подлежащее + appears to be." },
      { q: "She is thought to ___ (live) in Paris at the moment.", a: ["be living"], hint: "2 слова", why: "Действие в процессе сейчас → to be + -ing." },
      { q: "There are believed ___ over a hundred species in this lake.", opts: ["to be", "being", "that there are"], a: 0, why: "There are believed to be…" },
      { q: "It would ___ that the report was never sent.", a: ["seem", "appear"], hint: "1 слово", why: "It would seem / appear — осторожная формулировка." },
      { q: "The painting is said ___ stolen in 1990.", opts: ["to be", "to have been", "being"], a: 1, why: "Пассив в прошлом → to have been + 3-я форма." },
    ],
  },
  {
    id: "unreal-past", unit: "5B", title: "Unreal uses of past tenses", ru: "Прошедшее время для нереального: wish, if only, would rather, it's time, as if",
    explain: `
      <p>После некоторых выражений прошедшее время говорит не о прошлом, а о <b>нереальном</b>.</p>
      <h4>wish / if only</h4>
      <ul>
        <li>Сожаление о <b>настоящем</b> → past simple / continuous: <span class="ex">I wish I had more free time.</span> С be часто <i>were</i>: <span class="ex">If only I were taller.</span></li>
        <li>Сожаление о <b>прошлом</b> → past perfect: <span class="ex">I wish I hadn't said that.</span></li>
        <li>Раздражение, желание, чтобы кто-то изменил поведение → <b>would</b>: <span class="ex">I wish you would stop interrupting.</span> (Не о себе: не «I wish I would».)</li>
        <li><i>If only</i> — то же, но эмоциональнее.</li>
      </ul>
      <h4>would rather / would sooner</h4>
      <ul>
        <li>О себе — <b>+ глагол</b> без to: <span class="ex">I'd rather stay in tonight.</span></li>
        <li>О другом человеке — <b>+ подлежащее + past</b>: <span class="ex">I'd rather you didn't smoke here.</span></li>
      </ul>
      <h4>it's time / it's high time</h4>
      <p><b>+ подлежащее + past</b>: <span class="ex">It's time we went home.</span> (Или <i>It's time to go</i>.)</p>
      <h4>as if / as though</h4>
      <p>Нереальное сравнение — past: <span class="ex">He talks as if he owned the place.</span></p>
      <h4>supposing / imagine</h4>
      <p><span class="ex">Supposing you lost your job, what would you do?</span></p>`,
    ex: [
      { q: "I wish I ___ speak Japanese.", opts: ["can", "could", "would"], a: 1, why: "Сожаление о настоящем → past: could." },
      { q: "I wish I ___ (not / eat) so much last night.", a: ["hadn't eaten", "had not eaten"], hint: "2–3 слова", why: "Сожаление о прошлом → past perfect." },
      { q: "I wish you ___ stop leaving your socks on the floor!", opts: ["would", "will", "had"], a: 0, why: "Раздражение чужим поведением → wish + would." },
      { q: "I'd rather you ___ tell anyone about this.", opts: ["don't", "didn't", "won't"], a: 1, why: "Would rather + другой человек + past." },
      { q: "I'd rather ___ at home tonight, if you don't mind.", opts: ["stay", "to stay", "stayed"], a: 0, why: "О себе: would rather + глагол без to." },
      { q: "It's high time you ___ (get) a job.", a: ["got"], hint: "1 слово", why: "It's (high) time + подлежащее + past." },
      { q: "He behaves as if he ___ the boss.", opts: ["is", "were", "will be"], a: 1, why: "Нереальное сравнение → past (were)." },
      { q: "If only I ___ listened to your advice!", a: ["had"], hint: "1 слово", why: "О прошлом → past perfect: had listened." },
      { q: "Supposing you ___ the lottery, what would you buy?", opts: ["win", "won", "had won"], a: 1, why: "Воображаемая ситуация в будущем/настоящем → past." },
      { q: "I wish it ___ so cold today.", a: ["wasn't", "weren't", "was not", "were not"], hint: "1–2 слова", why: "О настоящем → past: wasn't / weren't." },
    ],
  },
]);
