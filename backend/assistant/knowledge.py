"""General2 GEN_06: what the assistant knows out of the box, in English,
Kinyarwanda and French. `match` is the text it is matched against (typical
questions and keywords in all three languages); `answers` is what it says.
Staff-answered questions saved as FAQ entries (see models.FAQEntry) extend this."""

KNOWLEDGE = [
    {
        "key": "what_is",
        "match": "what is tanga igitekerezo? about the system. what does this website do? purpose. "
                 "tanga igitekerezo ni iki? iyi sisitemu ni iki? ikora iki? "
                 "qu'est-ce que tanga igitekerezo ? a quoi sert ce systeme ? presentation",
        "answers": {
            "en": "Tanga Igitekerezo is a digital Agasanduku k'ibitekerezo (suggestion box). You send a suggestion, idea, complaint or word of appreciation; it is routed to the team responsible, answered on the record, and you can follow it with a tracking code until it is resolved.",
            "rw": "Tanga Igitekerezo ni agasanduku k'ibitekerezo ka digitale. Wohereza igitekerezo, ikibazo, ikirego cyangwa ishimwe; gihabwa itsinda rishinzwe kugikemura, rikagisubiza, ukagikurikirana ukoresheje nimero ikurikirana kugeza gikemutse.",
            "fr": "Tanga Igitekerezo est une boîte à suggestions numérique (Agasanduku k'ibitekerezo). Vous envoyez une suggestion, une idée, une plainte ou un remerciement ; elle est transmise à l'équipe responsable, reçoit une réponse officielle, et vous la suivez avec un code de suivi jusqu'à sa résolution.",
        },
        "followups": ["how_submit", "track"],
    },
    {
        "key": "how_submit",
        "match": "how do i submit a suggestion? how to send an idea. how can i submit a complaint? where do i start? steps to submit. send my feedback. "
                 "nigute nohereza igitekerezo? nigute natanga ikirego? nshaka kohereza igitekerezo. "
                 "comment soumettre une suggestion ? comment envoyer une plainte ? deposer mon avis",
        "answers": {
            "en": "Click “Submit” in the top menu, choose how you want to appear (anonymous, confidential or identified), pick a category and, if you know it, a department, then describe your suggestion, idea, complaint or appreciation. You can attach a file. When you send it you receive a tracking code — keep it.",
            "rw": "Kanda kuri «Ohereza» mu rutonde rwo hejuru, hitamo uko ushaka kwiyerekana (utazwi, ibanga cyangwa uzwi), hitamo icyiciro n'ishami niba ubizi, hanyuma usobanure igitekerezo, ikibazo, ikirego cyangwa ishimwe ryawe. Ushobora no kongeraho dosiye. Nurangiza uhabwa nimero ikurikirana — irinde kuyibura.",
            "fr": "Cliquez sur « Soumettre » dans le menu, choisissez comment apparaître (anonyme, confidentiel ou identifié), sélectionnez une catégorie et, si vous la connaissez, un service, puis décrivez votre suggestion, idée, plainte ou remerciement. Vous pouvez joindre un fichier. À l'envoi, vous recevez un code de suivi : gardez-le.",
        },
        "followups": ["anonymous", "attachments"],
    },
    {
        "key": "anonymous",
        "match": "can i submit anonymously? is it anonymous? will they know who i am? hide my name. send without my name. send my idea without my name. can i send a suggestion without my name. without giving my name. stay anonymous. confidential or identified difference. privacy of my identity. "
                 "nshobora kohereza ntamenyekanye? nohereze ntatanze izina ryanjye? ibanga? bazamenya ko ari njye? utazwi ibanga uzwi itandukaniro. "
                 "puis-je soumettre anonymement ? rester anonyme ? sans mon nom. anonyme confidentiel identifie difference. mon identite reste privee ?",
        "answers": {
            "en": "Yes. You choose: Anonymous — no name is ever collected; Confidential — your identity is recorded but only authorised staff can see it; Identified — a normal submission under your name. With any of them you can follow the case using the tracking code.",
            "rw": "Yego. Wihitiramo: Utazwi — nta zina ryawe ribikwa; Ibanga — umwirondoro wawe urabikwa ariko abakozi babifitiye uburenganzira gusa nibo bawubona; Uzwi — igitekerezo gisanzwe gifite izina ryawe. Muri ubwo buryo bwose ushobora gukurikirana ukoresheje nimero ikurikirana.",
            "fr": "Oui, vous choisissez : Anonyme — aucun nom n'est collecté ; Confidentiel — votre identité est enregistrée mais seul le personnel autorisé peut la voir ; Identifié — une soumission normale à votre nom. Dans tous les cas, vous suivez le dossier avec le code de suivi.",
        },
        "followups": ["track", "account"],
    },
    {
        "key": "track",
        "match": "how do i track my submission? check status of my case. follow progress. where is my suggestion? tracking page. see the reply. "
                 "nigute nkurikirana igitekerezo cyanjye? ndashaka kureba aho kigeze. imiterere y'ikirego. "
                 "comment suivre ma soumission ? verifier le statut de mon dossier. ou en est ma plainte ?",
        "answers": {
            "en": "Open the “Track” page and enter your tracking code (for example TGC-2026-10-05-0127). You will see the current status, the history and any reply from the institution. No account is needed.",
            "rw": "Fungura urupapuro rwa «Kurikirana» wandike nimero ikurikirana yawe (urugero TGC-2026-10-05-0127). Urabona aho kigeze, amateka yacyo n'igisubizo icyo ari cyo cyose cyatanzwe. Nta konti ukeneye.",
            "fr": "Ouvrez la page « Suivre » et saisissez votre code de suivi (par exemple TGC-2026-10-05-0127). Vous verrez le statut actuel, l'historique et toute réponse de l'institution. Aucun compte n'est nécessaire.",
        },
        "followups": ["statuses", "lost_code"],
    },
    {
        "key": "lost_code",
        "match": "i lost my tracking code. forgot my code. cannot find my reference number. recover code. "
                 "nabuze nimero ikurikirana. nibagiwe kode. nashaka kongera kubona nimero yanjye. "
                 "j'ai perdu mon code de suivi. code oublie. retrouver ma reference",
        "answers": {
            "en": "A tracking code cannot be recovered for anonymous submissions, because no identity is stored. If you submitted while signed in, open My submissions — your codes (including anonymous ones) are saved there. For next time, write the code down or take a screenshot when you submit.",
            "rw": "Nimero ikurikirana y'ibyoherejwe mu buryo butazwi ntishobora kugarurwa kuko nta mwirondoro ubikwa. Niba warohereje winjiye muri konti yawe, fungura «Ibyo nohereje» — nimero zawe (n'iz'ibyoherejwe mu buryo butazwi) zibikwa aho. Ubutaha, yandike cyangwa ufate ifoto y'ecran ukimara kohereza.",
            "fr": "Un code de suivi ne peut pas être récupéré pour une soumission anonyme, car aucune identité n'est conservée. Si vous étiez connecté, ouvrez « Mes soumissions » : vos codes (y compris anonymes) y sont enregistrés. La prochaine fois, notez le code ou faites une capture d'écran.",
        },
        "followups": ["account"],
    },
    {
        "key": "categories",
        "match": "what can i submit? types of feedback. categories. suggestion complaint appreciation others difference. what is a complaint? "
                 "nshobora kohereza iki? ibyiciro. igitekerezo ikirego ishimwe ibindi. "
                 "que puis-je soumettre ? types de retours. categories. autres. difference entre plainte et suggestion",
        "answers": {
            "en": "You can send a Suggestion (a way to improve a service), a Complaint (a problem to be looked into), an Appreciation (recognition for something done well) or choose Others for anything that doesn't fit those. All are handled in the same accountable way.",
            "rw": "Ushobora kohereza Igitekerezo (uburyo bwo kunoza serivisi), Ikirego (ikibazo gikwiye gukurikiranwa), Ishimwe (gushimira ikintu cyakozwe neza) cyangwa ugahitamo Ibindi ku cyo ushaka kivuga ibindi. Byose bikurikiranwa kimwe.",
            "fr": "Vous pouvez envoyer une Suggestion (améliorer un service), une Plainte (un problème à examiner), un Remerciement (reconnaître un travail bien fait) ou choisir Autres pour tout le reste. Tous sont traités avec la même rigueur.",
        },
        "followups": ["how_submit"],
    },
    {
        "key": "attachments",
        "match": "can i attach a file? upload a photo or document. which files are allowed? pdf image attachment. "
                 "nshobora kongeraho dosiye? gushyiraho ifoto cyangwa inyandiko. "
                 "puis-je joindre un fichier ? ajouter une photo ou un document. pieces jointes",
        "answers": {
            "en": "Yes. When you submit, drag and drop or browse to add files such as images, PDFs or documents. You can also attach a file when you reply to a request for more information.",
            "rw": "Yego. Mu kohereza, ushobora gukurura cyangwa guhitamo dosiye nk'amafoto, PDF cyangwa inyandiko. Ushobora no kongeraho dosiye mu gihe usubiza icyifuzo cy'andi makuru.",
            "fr": "Oui. Lors de l'envoi, glissez-déposez ou parcourez pour ajouter des fichiers (images, PDF, documents). Vous pouvez aussi joindre un fichier en répondant à une demande d'informations.",
        },
        "followups": [],
    },
    {
        "key": "needs_info",
        "match": "staff asked for more information. needs info status. how do i reply to the officer? respond to a question about my case. "
                 "bansabye andi makuru. nasubiza nte umukozi? nasubiza ikibazo cyerekeye ikirego cyanjye. "
                 "le personnel demande plus d'informations. comment repondre a l'agent ? statut informations requises",
        "answers": {
            "en": "If staff set your case to “More Information Needed”, open the Track page with your tracking code. You will see their question and can reply directly, with an attachment if useful. The case then returns to review.",
            "rw": "Niba abakozi bashyize ikirego cyawe kuri «Hakenewe andi makuru», fungura urupapuro rwa «Kurikirana» ukoresheje nimero yawe. Uzabona ikibazo cyabo ushobore gusubiza ako kanya, wongeraho dosiye nibiba ngombwa. Ikirego gisubira mu isuzuma.",
            "fr": "Si le personnel place votre dossier en « Informations complémentaires requises », ouvrez la page Suivre avec votre code. Vous verrez leur question et pourrez répondre directement, avec une pièce jointe si utile. Le dossier retourne alors en examen.",
        },
        "followups": ["statuses"],
    },
    {
        "key": "duration",
        "match": "how long does it take to get an answer? response time. when will i get a reply? how fast? delay. deadline. "
                 "bifata igihe kingana iki? nzabona igisubizo ryari? vuba? "
                 "combien de temps pour avoir une reponse ? delai de reponse. quand aurai-je une reponse ?",
        "answers": {
            "en": "There is no single fixed deadline because cases differ, but every step is recorded and urgent cases are flagged for priority attention. Once a case is marked resolved it closes automatically after 3 days, so nothing lingers. Check the Track page for the latest status.",
            "rw": "Nta gihe kimwe rihamye kuko ibirego biratandukanye, ariko buri ntambwe iraandikwa kandi ibihutirwa bihabwa umwanya wa mbere. Iyo ikirego kimaze gukemuka, gifungwa nyuma y'iminsi 3 mu buryo bwikora. Reba urupapuro rwa «Kurikirana» ngo umenye aho kigeze.",
            "fr": "Il n'y a pas de délai unique car les dossiers diffèrent, mais chaque étape est enregistrée et les cas urgents sont signalés en priorité. Une fois résolu, un dossier se clôture automatiquement après 3 jours. Consultez la page Suivre pour le dernier statut.",
        },
        "followups": ["priority", "statuses"],
    },
    {
        "key": "statuses",
        "match": "what do the statuses mean? received under review assigned responded resolved closed. meaning of status. "
                 "imiterere y'ikirego busobanura iki? yakiriwe iri gusuzumwa yahawe yasubijwe yakemutse yafunzwe. "
                 "que signifient les statuts ? recu en cours d'examen assigne repondu resolu clos",
        "answers": {
            "en": "Received — we have it. Under Review — an officer opened it. Assigned — routed to a department or person. More Information Needed — staff asked you something. Responded — staff replied. Resolved — the matter is settled. Closed — finished (3 days after resolved).",
            "rw": "Yakiriwe — twarayakiriye. Iri gusuzumwa — umukozi yarafunguye. Yahawe — yohererejwe ishami cyangwa umuntu. Hakenewe andi makuru — abakozi bakubajije. Yasubijwe — abakozi basubije. Yakemutse — ikibazo cyarangiye. Yafunzwe — birangiye (nyuma y'iminsi 3 ikemutse).",
            "fr": "Reçu — nous l'avons. En examen — un agent l'a ouvert. Assigné — transmis à un service ou une personne. Informations requises — le personnel vous a posé une question. Répondu — le personnel a répondu. Résolu — l'affaire est réglée. Clos — terminé (3 jours après la résolution).",
        },
        "followups": ["track"],
    },
    {
        "key": "priority",
        "match": "what about urgent cases? priority of my case. is an emergency handled faster? high priority. "
                 "ibirego byihutirwa bikorwa bite? ibyihutirwa. "
                 "les cas urgents ? priorite de mon dossier. une urgence est-elle traitee plus vite ?",
        "answers": {
            "en": "The system reads each new case and automatically gives it a priority — High, Medium or Low — using keywords chosen by the administrator. High and Medium cases go to the staff authorised to handle them first. You do not need to do anything; just describe the situation clearly.",
            "rw": "Sisitemu isoma buri kirego gishya ikagiha ubwihutirwe — Hejuru, Hagati cyangwa Hasi — hakurikijwe amagambo yatoranyijwe n'umuyobozi wa sisitemu. Ibirego byihutirwa bihabwa abakozi babifitiye uburenganzira mbere. Nta kindi usabwa uretse gusobanura neza ikibazo cyawe.",
            "fr": "Le système lit chaque nouveau dossier et lui attribue automatiquement une priorité — Haute, Moyenne ou Basse — selon des mots-clés choisis par l'administrateur. Les dossiers prioritaires vont d'abord au personnel habilité. Décrivez simplement la situation clairement.",
        },
        "followups": ["duration"],
    },
    {
        "key": "language",
        "match": "which languages are supported? kinyarwanda french english. change language. translate. "
                 "indimi zikoreshwa ni izihe? guhindura ururimi. "
                 "quelles langues sont disponibles ? changer de langue. francais kinyarwanda anglais",
        "answers": {
            "en": "The whole system is available in English, Kinyarwanda and French. Use the language switcher in the top menu to change it at any time.",
            "rw": "Sisitemu yose iboneka mu Cyongereza, Ikinyarwanda n'Igifaransa. Koresha ihitamo ry'ururimi riri hejuru mu rutonde kugira ngo uhindure igihe cyose.",
            "fr": "Tout le système est disponible en anglais, kinyarwanda et français. Utilisez le sélecteur de langue dans le menu du haut pour changer à tout moment.",
        },
        "followups": [],
    },
    {
        "key": "account",
        "match": "do i need an account? sign up benefits. create an account. my submissions page. keep my codes. "
                 "nkeneye konti? gufungura konti. ibyo nohereje. "
                 "ai-je besoin d'un compte ? creer un compte. mes soumissions. conserver mes codes",
        "answers": {
            "en": "No account is required to submit or track. An account is optional: it keeps all your tracking codes together under “My submissions” — including anonymous ones, which stay anonymous to staff.",
            "rw": "Nta konti ikenewe kugira ngo wohereze cyangwa ukurikirane. Konti ni ihitamo: ibika nimero zawe zose muri «Ibyo nohereje» — harimo n'iz'ibyoherejwe mu buryo butazwi, bikomeza kuba ibanga ku bakozi.",
            "fr": "Aucun compte n'est nécessaire pour soumettre ou suivre. Un compte est facultatif : il regroupe tous vos codes dans « Mes soumissions », y compris les anonymes, qui restent anonymes pour le personnel.",
        },
        "followups": ["anonymous"],
    },
    {
        "key": "staff_signin",
        "match": "i am a staff member. how do staff sign in? staff account approval. officer sign up. department head login. "
                 "ndi umukozi. abakozi binjira bate? kwemererwa konti. "
                 "je suis membre du personnel. connexion du personnel. approbation du compte agent",
        "answers": {
            "en": "Staff use the “Staff sign in” option. New staff can sign up, but an administrator must approve the account before it can sign in. Your permissions depend on the permission group the administrator gives you.",
            "rw": "Abakozi bakoresha «Kwinjira k'abakozi». Abakozi bashya bashobora kwiyandikisha, ariko umuyobozi wa sisitemu agomba kwemeza konti mbere yo kwinjira. Uburenganzira bwawe bushingiye ku itsinda umuyobozi aguhaye.",
            "fr": "Le personnel utilise « Connexion du personnel ». Les nouveaux agents peuvent s'inscrire, mais un administrateur doit approuver le compte avant la connexion. Vos droits dépendent du groupe de permissions attribué par l'administrateur.",
        },
        "followups": [],
    },
    {
        "key": "password",
        "match": "i forgot my password. reset password. change password. cannot sign in. "
                 "nibagiwe ijambo ry'ibanga. guhindura ijambo ry'ibanga. sinshobora kwinjira. "
                 "j'ai oublie mon mot de passe. changer le mot de passe. impossible de me connecter",
        "answers": {
            "en": "Once signed in you can change your password under Settings → Change password. If you cannot sign in at all, ask a system administrator to reset it for you.",
            "rw": "Winjiye, ushobora guhindura ijambo ry'ibanga muri «Igenamiterere» → «Guhindura ijambo ry'ibanga». Niba utabasha kwinjira rwose, saba umuyobozi wa sisitemu kurisubiramo.",
            "fr": "Une fois connecté, changez votre mot de passe dans Paramètres → Changer le mot de passe. Si vous ne pouvez pas vous connecter, demandez à un administrateur de le réinitialiser.",
        },
        "followups": [],
    },
    {
        "key": "privacy",
        "match": "is my data safe? who can see my submission? who reads my case? data protection. "
                 "amakuru yanjye arabungabunzwe? ni nde ubona ikirego cyanjye? "
                 "mes donnees sont-elles en securite ? qui peut voir ma soumission ?",
        "answers": {
            "en": "Only the staff handling your case can read it, and access depends on the case priority and their permissions. Anonymous submissions never store your identity; confidential ones restrict it to authorised staff. Internal staff discussions are never shown to the case owner.",
            "rw": "Abakozi bakurikirana ikirego cyawe nibo gusa bagisoma, kandi uburenganzira bushingiye ku bwihutirwa n'inshingano zabo. Ibyoherejwe mu buryo butazwi ntibibika umwirondoro wawe; iby'ibanga bigarukira ku bakozi babifitiye uburenganzira.",
            "fr": "Seul le personnel qui traite votre dossier peut le lire, selon la priorité et ses permissions. Les soumissions anonymes ne stockent jamais votre identité ; les confidentielles la réservent au personnel autorisé. Les échanges internes ne sont jamais montrés à l'auteur.",
        },
        "followups": ["anonymous"],
    },
    {
        "key": "ussd",
        "match": "i do not have a smartphone. how can i use this without internet? ussd *502#. feature phone. dial a code. basic phone. "
                 "ntabwo mfite telefoni igezweho. nakoresha nte iyi sisitemu? ussd kanda *502#. "
                 "je n'ai pas de smartphone. comment utiliser sans internet ? ussd composer *502# telephone basique",
        "answers": {
            "en": "No smartphone? No problem. On any phone, dial *502# and follow the menu to submit or track a case. The QR code on posters and boxes is the quickest way if you do have a smartphone; USSD is the alternative for everyone else. See the “Ways to access” page for the steps.",
            "rw": "Nta telefoni igezweho? Nta kibazo. Kuri telefoni iyo ari yo yose, kanda *502# ukurikize urutonde kugira ngo wohereze cyangwa ukurikirane ikirego. Kode ya QR iri ku byapa no ku dusanduku niyo nzira yihuta niba ufite telefoni igezweho; USSD ni ubundi buryo kuri bose. Reba urupapuro «Uko wakoresha» ku ntambwe zose.",
            "fr": "Pas de smartphone ? Aucun problème. Sur n'importe quel téléphone, composez *502# et suivez le menu pour soumettre ou suivre un dossier. Le code QR sur les affiches et les boîtes est le plus rapide si vous avez un smartphone ; l'USSD est l'alternative pour tous les autres. Voir la page « Comment accéder » pour les étapes.",
        },
        "followups": ["qr", "how_submit"],
    },
    {
        "key": "qr",
        "match": "what is the qr code? how do i scan the qr code? scan with my phone camera. qr poster. "
                 "kode ya qr ni iki? nayisoma nte? gusuzuma na kamera ya telefoni. "
                 "qu'est-ce que le code qr ? comment scanner le code qr ? affiche",
        "answers": {
            "en": "Open your phone camera, point it at the QR code on a poster, box or the Ways to access page, and tap the link that appears. It opens the submission page directly — no typing needed.",
            "rw": "Fungura kamera ya telefoni yawe, uyerekeze kuri kode ya QR iri ku cyapa, ku gasanduku cyangwa ku rupapuro «Uko wakoresha», ukande ihuza rigaragara. Ihita ifungura urupapuro rwo kohereza — nta kwandika bikenewe.",
            "fr": "Ouvrez l'appareil photo de votre téléphone, visez le code QR sur une affiche, une boîte ou la page « Comment accéder », puis touchez le lien qui apparaît. Il ouvre directement la page de soumission, sans rien taper.",
        },
        "followups": ["ussd"],
    },
    {
        "key": "rating",
        "match": "can i rate the answer? satisfaction survey. how satisfied am i. give feedback on the reply. "
                 "nshobora gutanga amanota ku gisubizo? "
                 "puis-je noter la reponse ? enquete de satisfaction",
        "answers": {
            "en": "Yes. Once your case is resolved, the Track page lets you rate how satisfied you are with the answer from 1 to 10 and add a comment. Your rating helps the institution improve.",
            "rw": "Yego. Ikirego cyawe nikimara gukemuka, urupapuro rwa «Kurikirana» rukwemerera gutanga amanota kuva kuri 1 kugeza 10 ku gisubizo wahawe no kongeraho igitekerezo. Amanota yawe afasha ikigo kunoza.",
            "fr": "Oui. Une fois votre dossier résolu, la page Suivre vous permet de noter votre satisfaction de 1 à 10 et d'ajouter un commentaire. Votre note aide l'institution à s'améliorer.",
        },
        "followups": [],
    },
    {
        "key": "cost",
        "match": "is it free? does it cost money? do i have to pay? fees. "
                 "ni ubuntu? bisaba amafaranga? ngomba kwishyura? "
                 "est-ce gratuit ? dois-je payer ? frais",
        "answers": {
            "en": "Submitting and tracking are free on the website. If you use the USSD service, your mobile operator's normal session charges may apply.",
            "rw": "Kohereza no gukurikirana ni ubuntu ku rubuga. Niba ukoresha USSD, ibiciro bisanzwe by'umukoresha wa telefoni bishobora kubaho.",
            "fr": "Soumettre et suivre est gratuit sur le site. Avec le service USSD, les frais de session habituels de votre opérateur peuvent s'appliquer.",
        },
        "followups": [],
    },
    {
        "key": "edit",
        "match": "can i edit or withdraw my submission? change what i wrote. delete my case. add more details. "
                 "nshobora guhindura cyangwa gukuraho ikirego cyanjye? kongeraho andi makuru. "
                 "puis-je modifier ou retirer ma soumission ? ajouter des details",
        "answers": {
            "en": "A submitted case cannot be edited, so that the record stays trustworthy. To add details, open the Track page with your code and send a reply — staff will see it on the case.",
            "rw": "Ikirego cyoherejwe ntigishobora guhindurwa kugira ngo amateka agume yizewe. Kugira ngo wongereho andi makuru, fungura «Kurikirana» ukoresheje nimero yawe ushyireho igisubizo — abakozi bazakibona.",
            "fr": "Un dossier envoyé ne peut pas être modifié, afin que l'historique reste fiable. Pour ajouter des détails, ouvrez la page Suivre avec votre code et envoyez une réponse : le personnel la verra sur le dossier.",
        },
        "followups": ["track"],
    },
    {
        "key": "contact",
        "match": "how can i contact you? support email phone address. where are you located? talk to a person. "
                 "nabaha nte? imeri telefoni aderesi. mwabonekera hehe? "
                 "comment vous contacter ? support email telephone adresse. ou etes-vous ?",
        "answers": {
            "en": "You can write to info@minijust.gov.rw or call 3936 (Kigali, Rwanda). For anything about a specific case, the quickest way is a reply on the Track page.",
            "rw": "Wandika kuri info@minijust.gov.rw cyangwa uhamagare 3936 (Kigali, u Rwanda). Ku kibazo cyerekeye ikirego runaka, inzira yihuta ni ugusubiza ku rupapuro rwa «Kurikirana».",
            "fr": "Écrivez à info@minijust.gov.rw ou appelez le 3936 (Kigali, Rwanda). Pour un dossier précis, le plus rapide est une réponse sur la page Suivre.",
        },
        "followups": [],
    },
    {
        "key": "praise",
        "match": "i want to say thank you. appreciation for a good service. praise a colleague. "
                 "nshaka gushimira. ishimwe kuri serivisi nziza. "
                 "je veux remercier. feliciter un service",
        "answers": {
            "en": "Lovely! Choose “Appreciation” as the category when you submit. Praise reaches the people who earned it and is recorded just like any other case.",
            "rw": "Byiza cyane! Hitamo icyiciro cya «Ishimwe» mu kohereza. Ishimwe rigera ku bariheraga kandi ribikwa nk'ibindi birego byose.",
            "fr": "Avec plaisir ! Choisissez la catégorie « Remerciement » en soumettant. Les félicitations parviennent à ceux qui les méritent et sont enregistrées comme tout autre dossier.",
        },
        "followups": [],
    },
]

KNOWLEDGE_BY_KEY = {k["key"]: k for k in KNOWLEDGE}

SMALL_TALK = {
    "greet": {
        "words": {"hi", "hello", "hey", "muraho", "mwiriwe", "mwaramutse", "bonjour", "bonsoir", "salut", "yo", "hola"},
        "answers": {
            "en": "Hello! I'm the Tanga Igitekerezo assistant. Ask me how to submit, track or reply to a case, how privacy works, or how to use the system without a smartphone.",
            "rw": "Muraho! Ndi umufasha wa Tanga Igitekerezo. Mbaza uko wohereza, ukurikirana cyangwa usubiza ikirego, uko ibanga ririndwa, cyangwa uko wakoresha sisitemu udafite telefoni igezweho.",
            "fr": "Bonjour ! Je suis l'assistant de Tanga Igitekerezo. Demandez-moi comment soumettre, suivre ou répondre à un dossier, comment fonctionne la confidentialité, ou comment utiliser le système sans smartphone.",
        },
    },
    "thanks": {
        "words": {"thanks", "thank", "thx", "merci", "murakoze", "urakoze", "ok", "okay", "great", "cool"},
        "answers": {
            "en": "You're welcome! Ask me anything else about the system.",
            "rw": "Ntacyo! Mbaza ikindi cyose kijyanye na sisitemu.",
            "fr": "Avec plaisir ! Posez-moi toute autre question sur le système.",
        },
    },
    "bye": {
        "words": {"bye", "goodbye", "aurevoir", "murabeho", "kwaheri"},
        "answers": {
            "en": "Goodbye! Your voice matters — come back any time.",
            "rw": "Murabeho! Ijwi ryawe ni ingenzi — ushobora kugaruka igihe cyose.",
            "fr": "Au revoir ! Votre voix compte, revenez quand vous voulez.",
        },
    },
}

FOLLOWUP_LABELS = {
    "en": {
        "how_submit": "How do I submit?", "track": "How do I track my case?", "anonymous": "Can I stay anonymous?",
        "attachments": "Can I attach a file?", "statuses": "What do the statuses mean?", "lost_code": "I lost my code",
        "account": "Do I need an account?", "priority": "What about urgent cases?", "duration": "How long does it take?",
        "ussd": "No smartphone? Use USSD", "qr": "How do I use the QR code?",
    },
    "rw": {
        "how_submit": "Nohereza nte?", "track": "Nkurikirana nte?", "anonymous": "Nshobora kutamenyekana?",
        "attachments": "Nshobora kongeraho dosiye?", "statuses": "Imiterere busobanura iki?", "lost_code": "Nabuze nimero yanjye",
        "account": "Nkeneye konti?", "priority": "Ibyihutirwa se?", "duration": "Bifata igihe kingana iki?",
        "ussd": "Nta telefoni igezweho? Koresha USSD", "qr": "Nakoresha nte kode ya QR?",
    },
    "fr": {
        "how_submit": "Comment soumettre ?", "track": "Comment suivre mon dossier ?", "anonymous": "Puis-je rester anonyme ?",
        "attachments": "Puis-je joindre un fichier ?", "statuses": "Que signifient les statuts ?", "lost_code": "J'ai perdu mon code",
        "account": "Ai-je besoin d'un compte ?", "priority": "Et les cas urgents ?", "duration": "Combien de temps ?",
        "ussd": "Pas de smartphone ? USSD", "qr": "Comment utiliser le code QR ?",
    },
}
