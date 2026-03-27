CLAUDE.md — GemRogue: Überstunden bis zum Endboss
Dieses Dokument ist die Hauptreferenz für alle Entwicklungsarbeiten. Lies es zuerst bevor du Code schreibst.

1. Elevator Pitch
Ein Auto-Battler Roguelite im Büroalltag-Setting. Der Spieler ist ein neuer Mitarbeiter, der sich durch die Etagen eines dysfunktionalen Konzerns kämpft — bewaffnet mit Buzzwords, Kaffee und einer mechanischen Tastatur. Ziel: die Gehaltserhöhung auf Etage 10. Oder einfach pünktlich nach Hause.
Ton: Satire, nicht Klamauk. Der Humor entsteht durch Wiedererkennbarkeit. Jede Mechanik spiegelt eine echte Bürosituation.

2. Setting — Die Etagen
EtageAbteilungVibeEndgegner1–2OnboardingVerwirrung, niemand erklärt wasHR-Bot3–4MarketingKreativität als Waffe, viel LärmHead of Brand5–6ProduktEndlose Priorisierungs-MeetingsProduct Owner7–8ControllingZahlen, Schweigen, MisstrauenCFO-Assistent9ITPassive Aggression, DunkelheitSenior Sysadmin10ChefetageStille, Teppichboden, AngstCEO (Endboss)
Sonderräume: Kantine = Rastplatz. Meetingraum = Eliteraum. Druckerraum = Fluchereignis (50/50 Schaden oder seltenes Item). Kaffeeküche = Shop.

3. Abteilungs-Resistenzen
Dieselben Attacken funktionieren überall, reagieren aber pro Abteilung anders. Das ist der Kern der Satire.
Attacken-TagMarketingProduktControllingITChefetagebuzzword+50% (eskalieren)neutral–30% (suchen Zahl)immun+20%konkrete-zahl+70% (Panik)+20%immunneutral–20%meeting-einladen–20% (mögen's)+40%+20%+80% (Horror)neutraldocu-schreibenneutral+30%+50%–50% (wollten sie eh)neutraleskalieren+30%+50%+60%neutralimmunsmalltalk–30% (mögen's)neutral+40%+60%–40% (Chefs lieben's)
Immun = 0 Schaden. Alle Werte sind Modifier auf den Basis-Schaden.

4. Das Gem-System
4.1 Gem-Rollen
Jeder Skill-Slot hat diese Struktur:
[ ACTIVE ] [ SUPPORT ] [ SUPPORT ] [ SUPPORT ] [ TRIGGER ]
Active Gem — definiert die Attacke. Genau einer pro Slot. Beispiele: "Buzzword platzieren", "Meeting einberufen", "Dokument schicken".
Support Gem — modifiziert den Active Gem im selben Slot. Bis zu 3 pro Slot. Beispiele: "Mehrfach-CC" (Attacke trifft alle im Raum), "Anglizismus-Booster" (+40% Buzzword-Schaden), "Dringlich markieren" (erhöht Priorität = Schaden).
Trigger Gem — ersetzt den normalen Angriffszyklus durch eine Bedingung. Maximal einer pro Slot. Beispiele: "Cast when Overlooked" (löst aus wenn der Charakter 2 Runden ignoriert wurde), "Cast on Coffee" (löst nach Kaffee-Buff aus), "Kurz-stör-Trigger" (löst aus wenn ein Gegner unter 30% HP fällt).
Der Spieler hat 3 Skill-Slots. Gems werden als Loot gefunden, genau wie Items.
4.2 Gem-Fusion
Zwei identische Gems gleichen Levels ergeben per Fusion einen Level+1-Gem. Maximum Level 3. Level erhöht immer den Basis-Effekt-Wert, nie die Mechanik selbst.
4.3 Tags
Jeder Active Gem hat Tags die bestimmen welche Abteilungs-Resistenzen greifen. Ein Gem kann mehrere Tags haben. Beispiel: "Strategiepapier erstellen" hat die Tags buzzword + docu-schreiben — beide Resistenz-Zeilen werden addiert.
4.4 Beispiel-Gems
Active:

Buzzword platzieren — Tags: buzzword — "Synergien heben, Paradigmen shiften."
Meeting einberufen — Tags: meeting-einladen — "Niemand weiß warum, alle müssen."
Zahlen präsentieren — Tags: konkrete-zahl — "Eine Excel-Tabelle als Waffe."
Eskalations-Mail — Tags: eskalieren — "CC an alle. Auch den CEO."
Smalltalk starten — Tags: smalltalk — "Wie war dein Wochenende?"

Support:

Anglizismus-Booster — buzzword-Attacken +40% Schaden
Reply-All — Attacke trifft alle Gegner im Raum statt einem
Dringlich markieren — +25% Schaden, aber nächste Runde –20% (Glaubwürdigkeit sinkt)
Bullet-Point-Formatierung — Support: reduziert Resistenz des Ziels um 20% für 2 Runden
Mit freundlichen Grüßen — heilt 5% HP nach jeder Attacke im Slot

Trigger:

Cast when Overlooked — löst aus nach 2 Runden ohne Angriff
Überstunden-Trigger — löst aus wenn eigene HP unter 30% (man arbeitet halt weiter)
Post-Meeting-Burst — löst einmalig aus nach einem meeting-einladen-Effekt
Koffein-Rush — löst nach Nutzung eines Kaffee-Items aus


5. Items (Ausrüstung)
Items stecken in Körper-Slots und geben passive Stats. Keine Gems in Items, keine Sockel.
SlotBeispiel-ItemFlavorHelmNoise-Cancelling-Kopfhörer"+20 Konzentration, immun gegen Smalltalk-Interrupt"WaffeMechanische Tastatur"+15 Einschüchterung durch Geräuschkulisse"OffhandKaffeebecher (voll)"+10% Angriffsgeschwindigkeit, 3 Runden"RüstungBusiness-Casual-Outfit"+25 Rüstung, +10% Buzzword-Effektivität"HandschuheErgonomische Maus"+8% Krit-Chance"SchuheLaufschuhe unterm Schreibtisch"+15% Fluchtchance"AmulettFirmenkreditkarte"+30 Gold nach jedem Kampf"Ring 1/2Mitarbeiterausweis"Zugang zu gesperrten Etagen"

6. Monster-Beispiele
Marketing (Etage 3–4):

Junior Brand Manager — niedrig HP, hoher Schaden mit buzzword, anfällig für konkrete-zahl
Influencer-Beauftragter — heilt sich jede Runde um 10% ("Engagement"), immun gegen smalltalk
Head of Brand (Boss) — wechselt jede 3. Runde "Markenstrategie" = ändert Resistenzen zufällig

IT (Etage 9):

Sysadmin — passiv, greift nur an wenn angesprochen, immun gegen buzzword
Ticketsystem-Geist — kann nicht direkt angegriffen werden, muss über "Ticket eskalieren" debufft werden
Senior Sysadmin (Boss) — "Neustart" heilt ihn auf 50% HP einmal pro Kampf

Controlling (Etage 7–8):

Budget-Analyst — reduziert deine verfügbaren Aktionen ("Budget gekürzt")
Audit-Drohung — Debuff der jeden Zug 5% deiner Stats reduziert bis entfernt
CFO-Assistent (Boss) — immun gegen alles außer konkrete-zahl, sehr hohe Rüstung


7. Technische Konventionen
Dateistruktur:

src/core/types.ts — alle Interfaces, keine Logik, keine Imports aus anderen src-Ordnern
src/systems/ — Spiellogik (CombatSystem, LootSystem, GemFusionSystem, StatsSystem)
src/data/ — konkrete Item/Gem/Monster-Definitionen als Arrays
src/ui/ — DOM-Rendering, keine Spiellogik
src/utils/ — random, save/load, sonstige Hilfsfunktionen

Regeln:

types.ts importiert nie aus systems/ oder ui/
Systems importieren aus core/ und utils/, nie aus ui/
UI importiert aus allem, schreibt aber nie direkt in GameState
Alle Zufallswerte laufen durch src/utils/random.ts
Save/Load läuft durch src/utils/save.ts — nie direkt localStorage aufrufen

Naming:

Gem-IDs: gem_buzzword_active, gem_replyall_support, gem_castonhit_trigger
Item-IDs: item_keyboard_weapon, item_headphones_helm
Monster-IDs: monster_juniorpm_marketing, monster_sysadmin_it

Noch nicht implementiert (MVP-Scope):

HMAC-Signierung des Save-States
Multiplayer / Leaderboard
Mehr als 3 Skill-Slots
Gem-Kombinationen mit mehr als 2 Gems


8. Was Claude beim Coden beachten soll
Wenn du neuen Code schreibst, prüfe immer:

Passt der Flavor-Text zum Büro-Satire-Ton? Kein generisches Fantasy-Vokabular.
Haben neue Gems Tags die mit der Resistenz-Tabelle in Abschnitt 3 kompatibel sind?
Neue Monster brauchen mindestens eine Schwäche und eine Resistenz — kein Monster ist neutral gegen alles.
Keine Spiellogik in UI-Dateien, kein DOM-Code in System-Dateien.
