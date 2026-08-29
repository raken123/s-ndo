/* Linguey — språkdata
 * Varje språk har enheter (units) med lektioner. En lektion har ordpar
 * [svenska, målspråket] och meningar [svenska, målspråket].
 * Datan används både av de vanliga lektionerna och av 3D-bonusläget.
 */
window.LINGUEY_VERSION = '1.0.0';

window.LINGUEY_DATA = (function () {
  'use strict';

  var languages = [
    /* ------------------------------------------------------------- SPANSKA */
    {
      id: 'es', name: 'Spanska', native: 'Español', flag: '🇪🇸',
      color: '#e11d48', color2: '#f59e0b', speech: 'es-ES',
      units: [
        {
          title: 'Grunderna', icon: '🌱',
          lessons: [
            {
              title: 'Hälsningar',
              words: [
                ['hej', 'hola'], ['god morgon', 'buenos días'], ['god natt', 'buenas noches'],
                ['hej då', 'adiós'], ['tack', 'gracias'], ['förlåt', 'perdón'],
                ['ja', 'sí'], ['nej', 'no']
              ],
              sentences: [
                ['hej hur mår du', 'hola qué tal'],
                ['tack så mycket', 'muchas gracias']
              ]
            },
            {
              title: 'Människor',
              words: [
                ['jag', 'yo'], ['du', 'tú'], ['han', 'él'], ['hon', 'ella'],
                ['vi', 'nosotros'], ['mamma', 'la madre'], ['pappa', 'el padre'],
                ['vän', 'el amigo']
              ],
              sentences: [
                ['jag är din vän', 'yo soy tu amigo'],
                ['hon är min mamma', 'ella es mi madre']
              ]
            },
            {
              title: 'Mat och dryck',
              words: [
                ['vatten', 'el agua'], ['bröd', 'el pan'], ['mjölk', 'la leche'],
                ['äpple', 'la manzana'], ['ost', 'el queso'], ['kaffe', 'el café'],
                ['fisk', 'el pescado'], ['ris', 'el arroz']
              ],
              sentences: [
                ['jag vill ha vatten', 'quiero agua'],
                ['brödet är gott', 'el pan está rico']
              ]
            },
            {
              title: 'Siffror',
              words: [
                ['en', 'uno'], ['två', 'dos'], ['tre', 'tres'], ['fyra', 'cuatro'],
                ['fem', 'cinco'], ['sex', 'seis'], ['tio', 'diez'], ['hundra', 'cien']
              ],
              sentences: [
                ['jag har två äpplen', 'tengo dos manzanas'],
                ['tre kaffe tack', 'tres cafés por favor']
              ]
            }
          ]
        },
        {
          title: 'Vardag', icon: '🏙️',
          lessons: [
            {
              title: 'Hemma',
              words: [
                ['hus', 'la casa'], ['dörr', 'la puerta'], ['bord', 'la mesa'],
                ['stol', 'la silla'], ['säng', 'la cama'], ['kök', 'la cocina'],
                ['fönster', 'la ventana'], ['nyckel', 'la llave']
              ],
              sentences: [
                ['huset är stort', 'la casa es grande'],
                ['nyckeln är på bordet', 'la llave está en la mesa']
              ]
            },
            {
              title: 'I staden',
              words: [
                ['gata', 'la calle'], ['tåg', 'el tren'], ['bil', 'el coche'],
                ['torg', 'la plaza'], ['butik', 'la tienda'], ['skola', 'la escuela'],
                ['sjukhus', 'el hospital'], ['hotell', 'el hotel']
              ],
              sentences: [
                ['var är stationen', 'dónde está la estación'],
                ['jag åker tåg', 'voy en tren']
              ]
            },
            {
              title: 'Tid',
              words: [
                ['i dag', 'hoy'], ['i morgon', 'mañana'], ['i går', 'ayer'],
                ['nu', 'ahora'], ['alltid', 'siempre'], ['aldrig', 'nunca'],
                ['vecka', 'la semana'], ['år', 'el año']
              ],
              sentences: [
                ['i dag är det måndag', 'hoy es lunes'],
                ['vi ses i morgon', 'nos vemos mañana']
              ]
            }
          ]
        },
        {
          title: 'Uttryck', icon: '💬',
          lessons: [
            {
              title: 'Känslor',
              words: [
                ['glad', 'feliz'], ['ledsen', 'triste'], ['trött', 'cansado'],
                ['hungrig', 'hambriento'], ['rädd', 'asustado'], ['kär', 'enamorado'],
                ['lugn', 'tranquilo'], ['arg', 'enfadado']
              ],
              sentences: [
                ['jag är väldigt trött', 'estoy muy cansado'],
                ['hon är glad i dag', 'ella está feliz hoy']
              ]
            },
            {
              title: 'Att resa',
              words: [
                ['flygplan', 'el avión'], ['resa', 'el viaje'], ['strand', 'la playa'],
                ['berg', 'la montaña'], ['karta', 'el mapa'], ['väska', 'la maleta'],
                ['biljett', 'el billete'], ['pass', 'el pasaporte']
              ],
              sentences: [
                ['jag reser till Spanien', 'viajo a España'],
                ['stranden är vacker', 'la playa es bonita']
              ]
            },
            {
              title: 'Småprat',
              words: [
                ['varför', 'por qué'], ['hur', 'cómo'], ['när', 'cuándo'],
                ['kanske', 'quizás'], ['naturligtvis', 'por supuesto'],
                ['jag vet inte', 'no lo sé'], ['snälla', 'por favor'], ['ursäkta', 'disculpe']
              ],
              sentences: [
                ['varför är du här', 'por qué estás aquí'],
                ['jag förstår inte', 'no entiendo']
              ]
            }
          ]
        }
      ]
    },

    /* ------------------------------------------------------------- FRANSKA */
    {
      id: 'fr', name: 'Franska', native: 'Français', flag: '🇫🇷',
      color: '#2563eb', color2: '#38bdf8', speech: 'fr-FR',
      units: [
        {
          title: 'Grunderna', icon: '🌱',
          lessons: [
            {
              title: 'Hälsningar',
              words: [
                ['hej', 'bonjour'], ['hej (informellt)', 'salut'], ['god kväll', 'bonsoir'],
                ['hej då', 'au revoir'], ['tack', 'merci'], ['förlåt', 'pardon'],
                ['ja', 'oui'], ['nej', 'non']
              ],
              sentences: [
                ['hej hur mår du', 'bonjour comment ça va'],
                ['tack så mycket', 'merci beaucoup']
              ]
            },
            {
              title: 'Människor',
              words: [
                ['jag', 'je'], ['du', 'tu'], ['han', 'il'], ['hon', 'elle'],
                ['vi', 'nous'], ['mamma', 'la mère'], ['pappa', 'le père'],
                ['vän', 'l’ami']
              ],
              sentences: [
                ['jag är din vän', 'je suis ton ami'],
                ['hon är min mamma', 'elle est ma mère']
              ]
            },
            {
              title: 'Mat och dryck',
              words: [
                ['vatten', 'l’eau'], ['bröd', 'le pain'], ['mjölk', 'le lait'],
                ['äpple', 'la pomme'], ['ost', 'le fromage'], ['kaffe', 'le café'],
                ['vin', 'le vin'], ['sås', 'la sauce']
              ],
              sentences: [
                ['jag vill ha vatten', 'je veux de l’eau'],
                ['brödet är gott', 'le pain est bon']
              ]
            },
            {
              title: 'Siffror',
              words: [
                ['en', 'un'], ['två', 'deux'], ['tre', 'trois'], ['fyra', 'quatre'],
                ['fem', 'cinq'], ['sex', 'six'], ['tio', 'dix'], ['hundra', 'cent']
              ],
              sentences: [
                ['jag har två äpplen', 'j’ai deux pommes'],
                ['tre kaffe tack', 'trois cafés s’il vous plaît']
              ]
            }
          ]
        },
        {
          title: 'Vardag', icon: '🏙️',
          lessons: [
            {
              title: 'Hemma',
              words: [
                ['hus', 'la maison'], ['dörr', 'la porte'], ['bord', 'la table'],
                ['stol', 'la chaise'], ['säng', 'le lit'], ['kök', 'la cuisine'],
                ['fönster', 'la fenêtre'], ['nyckel', 'la clé']
              ],
              sentences: [
                ['huset är stort', 'la maison est grande'],
                ['nyckeln är på bordet', 'la clé est sur la table']
              ]
            },
            {
              title: 'I staden',
              words: [
                ['gata', 'la rue'], ['tåg', 'le train'], ['bil', 'la voiture'],
                ['torg', 'la place'], ['butik', 'le magasin'], ['skola', 'l’école'],
                ['sjukhus', 'l’hôpital'], ['hotell', 'l’hôtel']
              ],
              sentences: [
                ['var är stationen', 'où est la gare'],
                ['jag åker tåg', 'je prends le train']
              ]
            },
            {
              title: 'Tid',
              words: [
                ['i dag', 'aujourd’hui'], ['i morgon', 'demain'], ['i går', 'hier'],
                ['nu', 'maintenant'], ['alltid', 'toujours'], ['aldrig', 'jamais'],
                ['vecka', 'la semaine'], ['år', 'l’année']
              ],
              sentences: [
                ['i dag är det måndag', 'aujourd’hui c’est lundi'],
                ['vi ses i morgon', 'à demain']
              ]
            }
          ]
        },
        {
          title: 'Uttryck', icon: '💬',
          lessons: [
            {
              title: 'Känslor',
              words: [
                ['glad', 'heureux'], ['ledsen', 'triste'], ['trött', 'fatigué'],
                ['hungrig', 'affamé'], ['rädd', 'effrayé'], ['kär', 'amoureux'],
                ['lugn', 'calme'], ['arg', 'fâché']
              ],
              sentences: [
                ['jag är väldigt trött', 'je suis très fatigué'],
                ['hon är glad i dag', 'elle est heureuse aujourd’hui']
              ]
            },
            {
              title: 'Att resa',
              words: [
                ['flygplan', 'l’avion'], ['resa', 'le voyage'], ['strand', 'la plage'],
                ['berg', 'la montagne'], ['karta', 'la carte'], ['väska', 'la valise'],
                ['biljett', 'le billet'], ['pass', 'le passeport']
              ],
              sentences: [
                ['jag reser till Frankrike', 'je voyage en France'],
                ['stranden är vacker', 'la plage est belle']
              ]
            }
          ]
        }
      ]
    },

    /* --------------------------------------------------------------- TYSKA */
    {
      id: 'de', name: 'Tyska', native: 'Deutsch', flag: '🇩🇪',
      color: '#f59e0b', color2: '#ef4444', speech: 'de-DE',
      units: [
        {
          title: 'Grunderna', icon: '🌱',
          lessons: [
            {
              title: 'Hälsningar',
              words: [
                ['hej', 'hallo'], ['god morgon', 'guten Morgen'], ['god kväll', 'guten Abend'],
                ['hej då', 'auf Wiedersehen'], ['tack', 'danke'], ['förlåt', 'entschuldigung'],
                ['ja', 'ja'], ['nej', 'nein']
              ],
              sentences: [
                ['hej hur mår du', 'hallo wie geht es dir'],
                ['tack så mycket', 'vielen Dank']
              ]
            },
            {
              title: 'Människor',
              words: [
                ['jag', 'ich'], ['du', 'du'], ['han', 'er'], ['hon', 'sie'],
                ['vi', 'wir'], ['mamma', 'die Mutter'], ['pappa', 'der Vater'],
                ['vän', 'der Freund']
              ],
              sentences: [
                ['jag är din vän', 'ich bin dein Freund'],
                ['hon är min mamma', 'sie ist meine Mutter']
              ]
            },
            {
              title: 'Mat och dryck',
              words: [
                ['vatten', 'das Wasser'], ['bröd', 'das Brot'], ['mjölk', 'die Milch'],
                ['äpple', 'der Apfel'], ['ost', 'der Käse'], ['kaffe', 'der Kaffee'],
                ['öl', 'das Bier'], ['korv', 'die Wurst']
              ],
              sentences: [
                ['jag vill ha vatten', 'ich möchte Wasser'],
                ['brödet är gott', 'das Brot ist lecker']
              ]
            },
            {
              title: 'Siffror',
              words: [
                ['en', 'eins'], ['två', 'zwei'], ['tre', 'drei'], ['fyra', 'vier'],
                ['fem', 'fünf'], ['sex', 'sechs'], ['tio', 'zehn'], ['hundra', 'hundert']
              ],
              sentences: [
                ['jag har två äpplen', 'ich habe zwei Äpfel'],
                ['tre kaffe tack', 'drei Kaffee bitte']
              ]
            }
          ]
        },
        {
          title: 'Vardag', icon: '🏙️',
          lessons: [
            {
              title: 'Hemma',
              words: [
                ['hus', 'das Haus'], ['dörr', 'die Tür'], ['bord', 'der Tisch'],
                ['stol', 'der Stuhl'], ['säng', 'das Bett'], ['kök', 'die Küche'],
                ['fönster', 'das Fenster'], ['nyckel', 'der Schlüssel']
              ],
              sentences: [
                ['huset är stort', 'das Haus ist groß'],
                ['nyckeln är på bordet', 'der Schlüssel ist auf dem Tisch']
              ]
            },
            {
              title: 'I staden',
              words: [
                ['gata', 'die Straße'], ['tåg', 'der Zug'], ['bil', 'das Auto'],
                ['torg', 'der Platz'], ['butik', 'der Laden'], ['skola', 'die Schule'],
                ['sjukhus', 'das Krankenhaus'], ['hotell', 'das Hotel']
              ],
              sentences: [
                ['var är stationen', 'wo ist der Bahnhof'],
                ['jag åker tåg', 'ich fahre mit dem Zug']
              ]
            },
            {
              title: 'Tid',
              words: [
                ['i dag', 'heute'], ['i morgon', 'morgen'], ['i går', 'gestern'],
                ['nu', 'jetzt'], ['alltid', 'immer'], ['aldrig', 'nie'],
                ['vecka', 'die Woche'], ['år', 'das Jahr']
              ],
              sentences: [
                ['i dag är det måndag', 'heute ist Montag'],
                ['vi ses i morgon', 'bis morgen']
              ]
            }
          ]
        },
        {
          title: 'Uttryck', icon: '💬',
          lessons: [
            {
              title: 'Känslor',
              words: [
                ['glad', 'glücklich'], ['ledsen', 'traurig'], ['trött', 'müde'],
                ['hungrig', 'hungrig'], ['rädd', 'ängstlich'], ['kär', 'verliebt'],
                ['lugn', 'ruhig'], ['arg', 'wütend']
              ],
              sentences: [
                ['jag är väldigt trött', 'ich bin sehr müde'],
                ['hon är glad i dag', 'sie ist heute glücklich']
              ]
            }
          ]
        }
      ]
    },

    /* ---------------------------------------------------------- ITALIENSKA */
    {
      id: 'it', name: 'Italienska', native: 'Italiano', flag: '🇮🇹',
      color: '#16a34a', color2: '#f43f5e', speech: 'it-IT',
      units: [
        {
          title: 'Grunderna', icon: '🌱',
          lessons: [
            {
              title: 'Hälsningar',
              words: [
                ['hej', 'ciao'], ['god dag', 'buongiorno'], ['god kväll', 'buonasera'],
                ['hej då', 'arrivederci'], ['tack', 'grazie'], ['förlåt', 'scusa'],
                ['ja', 'sì'], ['nej', 'no']
              ],
              sentences: [
                ['hej hur mår du', 'ciao come stai'],
                ['tack så mycket', 'grazie mille']
              ]
            },
            {
              title: 'Mat och dryck',
              words: [
                ['vatten', 'l’acqua'], ['bröd', 'il pane'], ['mjölk', 'il latte'],
                ['äpple', 'la mela'], ['ost', 'il formaggio'], ['kaffe', 'il caffè'],
                ['pasta', 'la pasta'], ['glass', 'il gelato']
              ],
              sentences: [
                ['jag vill ha vatten', 'voglio acqua'],
                ['pastan är god', 'la pasta è buona']
              ]
            },
            {
              title: 'Siffror',
              words: [
                ['en', 'uno'], ['två', 'due'], ['tre', 'tre'], ['fyra', 'quattro'],
                ['fem', 'cinque'], ['sex', 'sei'], ['tio', 'dieci'], ['hundra', 'cento']
              ],
              sentences: [
                ['jag har två äpplen', 'ho due mele'],
                ['tre kaffe tack', 'tre caffè per favore']
              ]
            }
          ]
        },
        {
          title: 'Vardag', icon: '🏙️',
          lessons: [
            {
              title: 'Hemma',
              words: [
                ['hus', 'la casa'], ['dörr', 'la porta'], ['bord', 'il tavolo'],
                ['stol', 'la sedia'], ['säng', 'il letto'], ['kök', 'la cucina'],
                ['fönster', 'la finestra'], ['nyckel', 'la chiave']
              ],
              sentences: [
                ['huset är stort', 'la casa è grande'],
                ['nyckeln är på bordet', 'la chiave è sul tavolo']
              ]
            },
            {
              title: 'I staden',
              words: [
                ['gata', 'la strada'], ['tåg', 'il treno'], ['bil', 'la macchina'],
                ['torg', 'la piazza'], ['butik', 'il negozio'], ['skola', 'la scuola'],
                ['hav', 'il mare'], ['hotell', 'l’albergo']
              ],
              sentences: [
                ['var är stationen', 'dov’è la stazione'],
                ['jag åker tåg', 'prendo il treno']
              ]
            },
            {
              title: 'Känslor',
              words: [
                ['glad', 'felice'], ['ledsen', 'triste'], ['trött', 'stanco'],
                ['hungrig', 'affamato'], ['rädd', 'spaventato'], ['kär', 'innamorato'],
                ['lugn', 'calmo'], ['arg', 'arrabbiato']
              ],
              sentences: [
                ['jag är väldigt trött', 'sono molto stanco'],
                ['hon är glad i dag', 'lei è felice oggi']
              ]
            }
          ]
        }
      ]
    },

    /* ------------------------------------------------------------- JAPANSKA */
    {
      id: 'ja', name: 'Japanska', native: '日本語', flag: '🇯🇵',
      color: '#db2777', color2: '#8b5cf6', speech: 'ja-JP',
      units: [
        {
          title: 'Grunderna', icon: '🌱',
          lessons: [
            {
              title: 'Hälsningar',
              words: [
                ['hej', 'konnichiwa'], ['god morgon', 'ohayou'], ['god natt', 'oyasumi'],
                ['hej då', 'sayounara'], ['tack', 'arigatou'], ['förlåt', 'gomen'],
                ['ja', 'hai'], ['nej', 'iie']
              ],
              sentences: [
                ['hej jag heter Anna', 'konnichiwa watashi wa Anna desu'],
                ['tack så mycket', 'arigatou gozaimasu']
              ]
            },
            {
              title: 'Människor',
              words: [
                ['jag', 'watashi'], ['du', 'anata'], ['vän', 'tomodachi'],
                ['mamma', 'okaasan'], ['pappa', 'otousan'], ['lärare', 'sensei'],
                ['student', 'gakusei'], ['människa', 'hito']
              ],
              sentences: [
                ['jag är student', 'watashi wa gakusei desu'],
                ['hon är min vän', 'kanojo wa watashi no tomodachi desu']
              ]
            },
            {
              title: 'Mat och dryck',
              words: [
                ['vatten', 'mizu'], ['ris', 'gohan'], ['te', 'ocha'],
                ['fisk', 'sakana'], ['kött', 'niku'], ['ägg', 'tamago'],
                ['gott', 'oishii'], ['äta', 'taberu']
              ],
              sentences: [
                ['jag vill ha vatten', 'mizu ga hoshii desu'],
                ['det är gott', 'oishii desu']
              ]
            }
          ]
        },
        {
          title: 'Vardag', icon: '🏙️',
          lessons: [
            {
              title: 'Siffror',
              words: [
                ['en', 'ichi'], ['två', 'ni'], ['tre', 'san'], ['fyra', 'yon'],
                ['fem', 'go'], ['sex', 'roku'], ['tio', 'juu'], ['hundra', 'hyaku']
              ],
              sentences: [
                ['tre kaffe tack', 'koohii mitsu kudasai'],
                ['jag är tjugo år', 'watashi wa nijuu sai desu']
              ]
            },
            {
              title: 'I staden',
              words: [
                ['station', 'eki'], ['tåg', 'densha'], ['bil', 'kuruma'],
                ['skola', 'gakkou'], ['hus', 'ie'], ['butik', 'mise'],
                ['stad', 'machi'], ['väg', 'michi']
              ],
              sentences: [
                ['var är stationen', 'eki wa doko desu ka'],
                ['jag åker tåg', 'densha de ikimasu']
              ]
            },
            {
              title: 'Tid',
              words: [
                ['i dag', 'kyou'], ['i morgon', 'ashita'], ['i går', 'kinou'],
                ['nu', 'ima'], ['morgon', 'asa'], ['kväll', 'yoru'],
                ['vecka', 'shuu'], ['år', 'toshi']
              ],
              sentences: [
                ['vi ses i morgon', 'ashita mata ne'],
                ['i dag är det varmt', 'kyou wa atsui desu']
              ]
            }
          ]
        }
      ]
    }
  ];

  /* Prestationer (achievements) */
  var achievements = [
    { id: 'first', title: 'Första steget', desc: 'Klara din första lektion', icon: '🎉' },
    { id: 'streak3', title: 'Tre i rad', desc: 'Håll en svit i 3 dagar', icon: '🔥' },
    { id: 'streak7', title: 'Veckokrigare', desc: 'Håll en svit i 7 dagar', icon: '📅' },
    { id: 'perfect', title: 'Perfektionist', desc: 'Klara en lektion utan fel', icon: '💯' },
    { id: 'bonus1', title: '3D-utforskare', desc: 'Klara en bonuslektion i 3D-läget', icon: '🕹️' },
    { id: 'bonus5', title: 'Världsvandrare', desc: 'Klara 5 bonuslektioner', icon: '🌍' },
    { id: 'xp500', title: 'Halvtusen', desc: 'Samla 500 XP', icon: '⭐' },
    { id: 'xp2000', title: 'XP-mästare', desc: 'Samla 2000 XP', icon: '🏆' },
    { id: 'repair', title: 'Comeback', desc: 'Rädda din svit med en reparation', icon: '🛟' },
    { id: 'polyglot', title: 'Polyglot', desc: 'Öva på tre olika språk', icon: '🗣️' }
  ];

  /* Bygger en platt lista av alla lektioner för ett språk */
  function flatLessons(lang) {
    var out = [];
    lang.units.forEach(function (unit, ui) {
      unit.lessons.forEach(function (lesson, li) {
        out.push({ unitIndex: ui, lessonIndex: li, unit: unit, lesson: lesson, key: ui + ':' + li });
      });
    });
    return out;
  }

  function getLanguage(id) {
    for (var i = 0; i < languages.length; i++) if (languages[i].id === id) return languages[i];
    return languages[0];
  }

  /* Alla ordpar för ett språk (används av 3D-läget) */
  function allWords(lang) {
    var out = [];
    lang.units.forEach(function (u) {
      u.lessons.forEach(function (l) {
        l.words.forEach(function (w) { out.push(w); });
      });
    });
    return out;
  }

  return {
    languages: languages,
    achievements: achievements,
    flatLessons: flatLessons,
    getLanguage: getLanguage,
    allWords: allWords
  };
})();
