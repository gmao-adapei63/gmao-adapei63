// ═════════════════════════════════════════════════════════════════
// MODÈLE "BAES" — premier suivi du moteur générique
// ═════════════════════════════════════════════════════════════════
// Ce fichier ne contient AUCUNE logique : uniquement la définition du
// modèle (générique, ne code aucune structure spécifique dans le moteur)
// et les données de départ réelles extraites de votre document Excel/PDF
// ("CONTRÔLE ET ESSAIS BLOCS B.A.E.S." — IME La Roussille).
//
// Les données de départ (152 points de contrôle, 29 locaux) sont fournies
// à titre de SEED : elles ne sont importées que si vous cliquez sur
// "Créer le suivi BAES" dans l'assistant — jamais automatiquement.
// Quelques lignes du document source étaient incomplètes (marque/année
// manquantes sur de rares points) : à vérifier/compléter dans l'app après
// import, exactement comme n'importe quelle donnée éditable.
// ═════════════════════════════════════════════════════════════════

const BAES_MODELE_DEF = {
    nom: 'Contrôle et essais blocs B.A.E.S.',
    domaine: 'Sécurité & Contrôles réglementaires',
    sousDomaine: 'Incendie',
    icone: '🔥',
    couleur: '#ef4444',
    groupePar: 'Local',
    champsItem: [
        {id:'repere',          label:'Repère',              type:'texte',   required:true},
        {id:'emplacement',     label:'Emplacement',         type:'texte',   required:true},
        {id:'marqueModeleRef', label:'Marque / Modèle / Réf', type:'texte', listeIntelligente:true},
        {id:'anneeFab',        label:'Année fabrication',   type:'texte'}
    ],
    controles: [
        {id:'visuel',   label:'Contrôle visuel',    champs:['date','etat','commentaire','photo']},
        {id:'decharge', label:'Contrôle en décharge', champs:['date','etat','commentaire','photo','signature']}
    ],
    etats: [
        {value:'OK', label:'OK', color:'var(--success)', commentRequired:false},
        {value:'HS', label:'HS', color:'var(--danger)',  commentRequired:true}
    ],
    source: {type:'xlsx', fileName:'INCENDIE_TABLEAU_SUIVI_CONTROLE_VISUEL_ET_DECHARGE_DES_BAES.xlsx'}
};

// Sections + items de départ (structure neutre, indépendante du moteur).
const BAES_SEED_SECTIONS = [
    {
        "nom": "MACHINERIE BALNEO",
        "items": [
            {
                "repere": "N1",
                "emplacement": "FILTRATION",
                "marqueModeleRef": "EATON LUM 16105",
                "anneeFab": "2020"
            },
            {
                "repere": "N2",
                "emplacement": "SORTIE LOCAL",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            }
        ]
    },
    {
        "nom": "SOUS SOL OUVERT",
        "items": [
            {
                "repere": "N3",
                "emplacement": "VERS LOCAL CHL",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            },
            {
                "repere": "N3 BIS",
                "emplacement": "LOCAL CHL",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            },
            {
                "repere": "N4",
                "emplacement": "PLAFOND FOND",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            },
            {
                "repere": "N5",
                "emplacement": "MUR SIPOREX",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            },
            {
                "repere": "N5 BIS",
                "emplacement": "LOCAL CHLORE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            }
        ]
    },
    {
        "nom": "LINGERIE",
        "items": [
            {
                "repere": "N6",
                "emplacement": "PORTE S/S BALNEO",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N7",
                "emplacement": "PLAFOND SECHOIRS",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "LOCAL TGBT",
        "items": [
            {
                "repere": "N8",
                "emplacement": "PORTE SAS",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N8 BIS",
                "emplacement": "PORTE EXT",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "L1",
                "emplacement": "Lampe portable",
                "marqueModeleRef": "Luminox LP100 10132B",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "SAS/COULOIR SOUS SOL",
        "items": [
            {
                "repere": "N9",
                "emplacement": "PORTE ESC EV AC",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N10",
                "emplacement": "COULOIR /SAS",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N11",
                "emplacement": "COULOIR/SAS",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N12",
                "emplacement": "COULOIR/SAS",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N13",
                "emplacement": "COULOIR MILIEU 1",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N13",
                "emplacement": "COULOIR MILIEU 1",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N14",
                "emplacement": "LOCAL SYNDIC",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N15",
                "emplacement": "COULOIR MILIEU 2",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N16",
                "emplacement": "SORTIE FOND",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "LOCAL COUCHES S/S",
        "items": [
            {
                "repere": "N17",
                "emplacement": "PORTE VS COULOIR",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N18",
                "emplacement": "PORTE VS EXT",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "LOCAL MENAGE S/S",
        "items": [
            {
                "repere": "N20",
                "emplacement": "PORTE ENTREE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N20 BIS",
                "emplacement": "LOCAL FOND",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "",
                "emplacement": "Service Technique",
                "marqueModeleRef": "",
                "anneeFab": ""
            },
            {
                "repere": "",
                "emplacement": "IME La Roussille",
                "marqueModeleRef": "",
                "anneeFab": ""
            }
        ]
    },
    {
        "nom": "COULOIR FOND VS CHAUFFERIE",
        "items": [
            {
                "repere": "N21",
                "emplacement": "FOND VS ASC",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "CHAUFFERIE",
        "items": [
            {
                "repere": "N22",
                "emplacement": "SAS1 CHAUFFERIE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N23",
                "emplacement": "SAS2 CHAUFFERIE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N24",
                "emplacement": "CIRCU CHAUFFERIE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N25",
                "emplacement": "FOND CHAUFFERIE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "L2",
                "emplacement": "Lampe Portable",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "ESCALIER EVAC NORD/OUEST",
        "items": [
            {
                "repere": "N26",
                "emplacement": "PORTE IS N0/1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N27",
                "emplacement": "NIVEAU 0",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N27 BIS",
                "emplacement": "EXT PORTE IS",
                "marqueModeleRef": "",
                "anneeFab": ""
            },
            {
                "repere": "N28",
                "emplacement": "ENTRE NIV0 ET NIV1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N29",
                "emplacement": "PORTE TERRASSE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N30",
                "emplacement": "ENTRE NIV1 ET NIV2",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N31",
                "emplacement": "PORTE TERRASSE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N32",
                "emplacement": "EXT ESC PORTE TER",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "COULOIR RDC EEAP",
        "items": [
            {
                "repere": "N33",
                "emplacement": "PORTE FD ESC EVA",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N34",
                "emplacement": "CLRLOCAL MENAGE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N35",
                "emplacement": "MILIEU COULOIR",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N36",
                "emplacement": "VERS ASCENCEUR",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N37",
                "emplacement": "VIEILLE PORTE/CLR",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N38",
                "emplacement": "VIEILLE PORTE/HALL",
                "marqueModeleRef": "URA 118218",
                "anneeFab": "?"
            },
            {
                "repere": "N39",
                "emplacement": "HT PORTE VS HALL",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N40",
                "emplacement": "PORTE VS UV4",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "L3",
                "emplacement": "Lampe Portable",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "INTERIEUR LOCAL MENAGE RDC",
        "items": [
            {
                "repere": "N41",
                "emplacement": "HAUT PORTE SORTIE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            }
        ]
    },
    {
        "nom": "LUDOTHEQUE BIBLIO RDC",
        "items": [
            {
                "repere": "N42",
                "emplacement": "HT PORTE VS CLR",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            },
            {
                "repere": "",
                "emplacement": "Service Technique",
                "marqueModeleRef": "",
                "anneeFab": ""
            },
            {
                "repere": "",
                "emplacement": "IME La Roussille",
                "marqueModeleRef": "",
                "anneeFab": ""
            }
        ]
    },
    {
        "nom": "BUREAU ACCUEIL RDC",
        "items": [
            {
                "repere": "N43",
                "emplacement": "PORTE IS TERRASSE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            }
        ]
    },
    {
        "nom": "UV1",
        "items": [
            {
                "repere": "N1 TER",
                "emplacement": "RASSE EXT",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2012"
            },
            {
                "repere": "N2",
                "emplacement": "CUISINE VS TERRASSE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N3",
                "emplacement": "SALLE VS TERRASSE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N4",
                "emplacement": "SALLE VS COULOIR",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N5",
                "emplacement": "HT PORTE ENTREE UV1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N6",
                "emplacement": "MILIEU COULOIR",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N7",
                "emplacement": "PORTE VS EVAC EXT",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            },
            {
                "repere": "N5",
                "emplacement": "HT PORTE ENTREE UV1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2012"
            }
        ]
    },
    {
        "nom": "UV2",
        "items": [
            {
                "repere": "N1",
                "emplacement": "HT PORTE ENT UV2",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "MILIEU COULOIR",
                "marqueModeleRef": "EATON LUM 16105",
                "anneeFab": "2020"
            },
            {
                "repere": "N3",
                "emplacement": "COULOIR WC",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N4",
                "emplacement": "SALLE ACTIVITES",
                "marqueModeleRef": "LUMINOX STD 45 AMPOULES",
                "anneeFab": "2008"
            },
            {
                "repere": "N5",
                "emplacement": "HT PORTE VS TERRASSE",
                "marqueModeleRef": "LUMINOX STD 45 AMPOULES",
                "anneeFab": "2008"
            }
        ]
    },
    {
        "nom": "SAS UV2 / UV3",
        "items": [
            {
                "repere": "N1",
                "emplacement": "VERS UV2",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2015"
            },
            {
                "repere": "N2",
                "emplacement": "VERS UV3",
                "marqueModeleRef": "EATON STD 65C AMPOULES",
                "anneeFab": "2007"
            }
        ]
    },
    {
        "nom": "UV3",
        "items": [
            {
                "repere": "N1",
                "emplacement": "COULOIR VS CHAMBRES",
                "marqueModeleRef": "LUMINOX STD 65C 10102 AMP.",
                "anneeFab": "2013"
            },
            {
                "repere": "N2",
                "emplacement": "CLR VERS ACTIVITES",
                "marqueModeleRef": "LUMINOX STD 65C 10102 AMP.",
                "anneeFab": "2013"
            },
            {
                "repere": "N3",
                "emplacement": "HT PORTE VERS ESPLANADE",
                "marqueModeleRef": "LUMINOX STD 65C 10102 AMP.",
                "anneeFab": "2013"
            },
            {
                "repere": "N4",
                "emplacement": "CUISINE VS PARC",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2015"
            }
        ]
    },
    {
        "nom": "LOCAL MENAGE S/S",
        "items": [
            {
                "repere": "N1",
                "emplacement": "ENTREE UNITE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N1BIS",
                "emplacement": "COULOIR HT EXCTINCTEUR",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "HT PRT VS ESCALIERS EVAC.",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N3",
                "emplacement": "HT PORTE ACTIVITES",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N4",
                "emplacement": "EVAC VS TERRASSE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N4BIS",
                "emplacement": "EXT TERRASSE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N5",
                "emplacement": "FD COULOIR VS CH",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "",
                "emplacement": "Service Technique",
                "marqueModeleRef": "",
                "anneeFab": ""
            },
            {
                "repere": "",
                "emplacement": "IME La Roussille",
                "marqueModeleRef": "",
                "anneeFab": ""
            }
        ]
    },
    {
        "nom": "BALNEO",
        "items": [
            {
                "repere": "N1",
                "emplacement": "PLAFOND SAS BALNEO",
                "marqueModeleRef": "SCHNEIDER OVA 59100",
                "anneeFab": "2021"
            },
            {
                "repere": "N2",
                "emplacement": "VESTIAIRE HOMMES",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2013"
            },
            {
                "repere": "N3",
                "emplacement": "VESTIAIRE FEMMES",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2013"
            },
            {
                "repere": "N4",
                "emplacement": "BASSIN PORTE EVAC",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2013"
            },
            {
                "repere": "N5",
                "emplacement": "BASSIN PORTE EVAC",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2013"
            }
        ]
    },
    {
        "nom": "ESCALIERS EVACUATION NORD / EST",
        "items": [
            {
                "repere": "N1",
                "emplacement": "PORTE VS EXT NIV0",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "VERS PORTE UV4",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N3",
                "emplacement": "ENTRE NIV0 ET NIV1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N4",
                "emplacement": "NIVEAU 1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N5",
                "emplacement": "ENTRE NIV1 ET NIV2",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N6",
                "emplacement": "NIVEAU 2",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "HALL EEAP",
        "items": [
            {
                "repere": "N1",
                "emplacement": "SAS VITRE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "PLFD PRT HALL",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "ESCALIERS CENTRAL BOIS",
        "items": [
            {
                "repere": "N1",
                "emplacement": "NIV1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N1 BIS",
                "emplacement": "PALIER G NIV1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N1 TER",
                "emplacement": "PALIER D NIV1",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "ENTRE NIV1 ET NIV2",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N3",
                "emplacement": "NIV2 ENT ADMIN",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "COULOIR R+1",
        "items": [
            {
                "repere": "N1",
                "emplacement": "FD PORTE UV5",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "MILIEU GAUCHE ESCALIERS",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N3",
                "emplacement": "MILIEU DROITE ESC",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N4",
                "emplacement": "FD HT PRT ESC EVAC",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N5",
                "emplacement": "MILIEU CLR INFIRMIER",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N6",
                "emplacement": "FOND SALLE ACTIV",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N6 BIS",
                "emplacement": "PLACARD FOND SURV",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N7",
                "emplacement": "LOCAL MENAGE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "UV5",
        "items": [
            {
                "repere": "N1",
                "emplacement": "HT PORTE ENTREE",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "CLR WC PERSONNEL",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N3",
                "emplacement": "COULOIR VS CHBRES",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N4",
                "emplacement": "MILIEU CLR/ACTIVITES",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N5",
                "emplacement": "CRT SALLE ACTIV",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N6",
                "emplacement": "FD ESC EVAC OUEST",
                "marqueModeleRef": "LUMINOX PLANET TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N7",
                "emplacement": "EXT PRT TERRASSE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "",
                "emplacement": "Service Technique",
                "marqueModeleRef": "",
                "anneeFab": ""
            },
            {
                "repere": "",
                "emplacement": "IME La Roussille",
                "marqueModeleRef": "",
                "anneeFab": ""
            }
        ]
    },
    {
        "nom": "COULOIR R+2",
        "items": [
            {
                "repere": "N1",
                "emplacement": "FILTRATION",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16025",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "MILIEU CLR GAUCHE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16025",
                "anneeFab": "2011"
            },
            {
                "repere": "N3",
                "emplacement": "MILIEU CLR GRH",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N3 BIS",
                "emplacement": "PRT MILI CLR GRH",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N3 TER",
                "emplacement": "PRT MIL CLR GRH",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N4",
                "emplacement": "MILIEU CLR DROITE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N5",
                "emplacement": "HT PRT ESC EVAC",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N6",
                "emplacement": "PLFD BAIE INFO/CUI",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N7",
                "emplacement": "ESC BOIS PRT IS",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N7 BIS",
                "emplacement": "LOCAL MENAGE R+2",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "TERRASSE R+2",
        "items": [
            {
                "repere": "N7",
                "emplacement": "EXT TOIT / INFIRMERIE",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N8",
                "emplacement": "EXT TOIT / ACTIVITE R+1",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N9",
                "emplacement": "FD CLR ESC TERRASSES",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N10",
                "emplacement": "EXT TOIT / UV5",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "COMBLES",
        "items": [
            {
                "repere": "N1",
                "emplacement": "HT PRT ACCES COMBLES",
                "marqueModeleRef": "",
                "anneeFab": ""
            },
            {
                "repere": "N2",
                "emplacement": "ESC COMBLES",
                "marqueModeleRef": "LUMINOX TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N3",
                "emplacement": "VERS FD EST",
                "marqueModeleRef": "LUMINOX TIM 16001",
                "anneeFab": "2011"
            },
            {
                "repere": "N4",
                "emplacement": "HAUT ESCALIERS",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N5",
                "emplacement": "VS PRT CBL OUEST",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N6",
                "emplacement": "MILIEU POUTRE BOIS",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            }
        ]
    },
    {
        "nom": "PAVILLON EXTERNAT",
        "items": [
            {
                "repere": "N1",
                "emplacement": "RAMPE ACCES EXT",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N1 BIS",
                "emplacement": "HT PORTE SAS 1",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N2",
                "emplacement": "HT PORTE SAS 2",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N2 BIS",
                "emplacement": "HT PORTE SAS 2",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N3",
                "emplacement": "HT PORTE ENTREE UJ6",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N4",
                "emplacement": "INT PORTE TERRASSE UJ6",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N5",
                "emplacement": "EXT TERRASSE UJ6",
                "marqueModeleRef": "LUMINOX STD 65C",
                "anneeFab": "2008"
            },
            {
                "repere": "N5 BIS",
                "emplacement": "RAMPE TERRASSE UJ6",
                "marqueModeleRef": "LUMINOX STD 65C",
                "anneeFab": "2008"
            },
            {
                "repere": "N6",
                "emplacement": "HT PORTE ENTREE UJ7",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N6 BIS",
                "emplacement": "MILIEU COULOIR UJ7",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N7",
                "emplacement": "INT VS PRT TERRASSE UJ7",
                "marqueModeleRef": "LUMINOX ULTRALED 45 16005",
                "anneeFab": "2011"
            },
            {
                "repere": "N8",
                "emplacement": "EXT TERRASSE UJ7",
                "marqueModeleRef": "LUMINOX STD 65C",
                "anneeFab": "2008"
            },
            {
                "repere": "",
                "emplacement": "Service Technique",
                "marqueModeleRef": "",
                "anneeFab": ""
            },
            {
                "repere": "",
                "emplacement": "IME La Roussille",
                "marqueModeleRef": "",
                "anneeFab": ""
            }
        ]
    }
];

// Crée le modèle BAES + une première campagne pré-remplie avec les données
// ci-dessus. Fonction appelée UNE SEULE FOIS depuis l'assistant "Nouveau suivi"
// (bouton dédié "Importer le modèle BAES fourni"), jamais au chargement de l'app.
function creerSuiviBAESDepuisSeed(nomCampagne){
    const modeleId = SuivisEngine.createModele(BAES_MODELE_DEF);
    const campagneId = SuivisEngine.createCampagne(modeleId, nomCampagne || 'Campagne initiale');
    BAES_SEED_SECTIONS.forEach((section, idx) => {
        const sectionId = SuivisEngine.addSection(campagneId, section.nom, idx);
        section.items.forEach(it => {
            SuivisEngine.addItem(sectionId, campagneId, modeleId, {
                repere: it.repere,
                emplacement: it.emplacement,
                marqueModeleRef: it.marqueModeleRef,
                anneeFab: it.anneeFab
            });
        });
    });
    return {modeleId, campagneId};
}

window.BAES_MODELE_DEF = BAES_MODELE_DEF;
window.BAES_SEED_SECTIONS = BAES_SEED_SECTIONS;
window.creerSuiviBAESDepuisSeed = creerSuiviBAESDepuisSeed;
