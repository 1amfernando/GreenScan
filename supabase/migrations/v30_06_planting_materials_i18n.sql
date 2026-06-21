-- v30.06 · planting_materials: lokalisierte Item-Namen (Baum-Planer Stückliste mehrsprachig)
alter table public.planting_materials
  add column if not exists item_fr text,
  add column if not exists item_it text,
  add column if not exists item_en text,
  add column if not exists item_es text;

update public.planting_materials set item_fr=v.fr, item_it=v.it, item_en=v.en, item_es=v.es
from (values
 ('anbindeband','Lien coco / d''attache (lien pour arbre)','Legaccio in cocco / di fissaggio','Coir / tree tie','Atadura de coco / fijación'),
 ('drainagekies','Gravier de drainage (sac)','Ghiaia drenante (sacco)','Drainage gravel (bag)','Grava de drenaje (saco)'),
 ('giessrand-vlies','Cuvette d''arrosage / toile de paillage','Conca d''irrigazione / telo pacciamante','Watering basin / mulch fabric','Alcorque / lámina de acolchado'),
 ('hornspaene','Corne broyée / engrais de plantation (kg)','Corno macinato / concime (kg)','Hoof & horn / planting fertiliser (kg)','Cuerno molido / abono de plantación (kg)'),
 ('pflanzerde','Terreau de plantation / compost (sac 40 l)','Terriccio / compost (sacco 40 l)','Planting soil / compost (40 l bag)','Tierra de plantación / compost (saco 40 l)'),
 ('pflanzpfahl','Tuteur (acacia / traité)','Palo di sostegno (acacia / impregnato)','Tree stake (acacia / treated)','Tutor (acacia / tratado)'),
 ('rindenmulch','Paillis d''écorce (sac)','Pacciame di corteccia (sacco)','Bark mulch (bag)','Mantillo de corteza (saco)'),
 ('verbissschutz','Protège-tronc anti-gibier (spirale / grillage individuel)','Protezione anti-morso (spirale / rete singola)','Browse guard (spiral / wire mesh)','Protector anti-roedura (espiral / malla individual)'),
 ('werkzeug-pauschal','Kit de plantation / outils (bêche/sécateur)','Set di piantagione / attrezzi (vanga/cesoie)','Planting set / tools (spade/pruner)','Kit de plantación / herramientas (pala/tijeras)'),
 ('wildschutzzaun','Clôture anti-gibier (grillage, par m)','Recinzione anti-selvaggina (rete, al m)','Wildlife fence (mesh, per m)','Valla anti-fauna (malla, por m)'),
 ('wuehlmauskorb','Panier anti-campagnol (panier de plantation)','Cestello anti-arvicola (cestello di piantagione)','Vole wire basket (planting basket)','Cesta anti-topillo (cesta de plantación)')
) as v(k,fr,it,en,es)
where planting_materials.item_key=v.k;
