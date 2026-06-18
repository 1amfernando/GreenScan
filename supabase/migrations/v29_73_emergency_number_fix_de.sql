-- v29.73 · SICHERHEITS-FIX (DE-Quelle): 4 tödliche Pilze hatten fälschlich "144 Tox-Info"
-- als Notrufnummer. Tox Info Suisse = 145 (144 = Sanitätsnotruf). Vom Übersetzungs-Pass
-- aufgedeckt. Korrigiert auf "Tox Info Suisse 145 / Notfall 144".
update public.mushroom_register set emergency_action = 'Tox Info Suisse 145 / Notfall 144. Krankenhaus.', updated_at = now() where slug='amanita_muscaria';
update public.mushroom_register set emergency_action = 'Tox Info Suisse 145 / Notfall 144. Dringend ins Krankenhaus.', updated_at = now() where slug='amanita_pantherina';
update public.mushroom_register set emergency_action = 'SOFORT Tox Info Suisse 145 / Notfall 144. Klinik, Silibinin, ggf. Lebertransplantation.', updated_at = now() where slug='amanita_phalloides';
update public.mushroom_register set emergency_action = 'Sofort Tox Info Suisse 145 / Notfall 144. Klinik, Dialyse-Vorbereitung (Nierenversagen).', updated_at = now() where slug='cortinarius_orellanus';
