require('dotenv').config();

async function getOpenAPI() {
  const url = `${process.env.SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  const schemas = json.definitions || (json.components && json.components.schemas);
  if (schemas && schemas.contacto) {
    console.log('contacto props:', Object.keys(schemas.contacto.properties));
  } else {
    console.log('contacto schema not found in OpenAPI');
  }
}
getOpenAPI();
