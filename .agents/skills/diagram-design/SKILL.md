---
name: diagram-design
description: Diseña diagramas de arquitectura autocontenidos en HTML + SVG, legibles en móvil y desktop, con la paleta del proyecto. Úsala para explicar datos, capas y flujos sin depender de herramientas externas.
---

# Diagram Design

## Cuándo usarla

Para explicar una arquitectura, un flujo de datos o un refactor en una sola
página que abra en cualquier navegador y se pueda imprimir o capturar.

## Reglas

1. **Autocontenido**: HTML + CSS + SVG inline. Sin JS, sin CDNs salvo fuentes.
2. **Una tesis visual**: el diagrama responde una pregunta; el título lo dice.
3. **Jerarquía real**: los bloques representan capas/entidades, no decoración.
   No inventes pasos ni numeración que el sistema no tenga.
4. **Paleta del proyecto**: pine (`#0f5132`), gold (`#d99a2b`), cream
   (`#f6f1e5`), ink (`#17211b`), coral solo para riesgos.
5. **Legibilidad**: mínimo 14px en texto, contraste AA, bloques con borde y
   fondo; el flujo se lee de izquierda a derecha en desktop y de arriba a
   abajo en móvil.
6. **Accesibilidad**: `<main>`, encabezados reales, listas semánticas,
   `aria-label` en SVG decorativos, foco visible, respeta
   `prefers-reduced-motion`.
7. **Sin promesas**: si algo está fuera de alcance, dilo en una nota.

## Estructura recomendada

- Eyebrow + título + subtítulo.
- 3 columnas: **datos conservados**, **capa nueva**, **vistas**.
- Una banda inferior con las dos lentes (personal / hogar) y las reglas.
- Nota metodológica y fecha/fuente.

## Verificación

- Abrir en navegador a 1280px y 375px sin scroll horizontal.
- `python3 scripts/self_check.py` (si existe) valida presencia de secciones y
  ausencia de dependencias externas.
