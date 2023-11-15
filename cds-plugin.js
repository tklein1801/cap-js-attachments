const fs = require('fs')
const path = require('path')
const cds = require('@sap/cds')

const { connectToAttachmentsService, hasResources } = require('./lib/helpers')


cds.on('loaded', async (m) => {

	// Get definitions from Dummy entity in our models
	const { 'sap.attachments.aspect': aspect } = m.definitions; if (!aspect) return // some other model
	const { '@UI.Facets': [facet], elements: { attachments } } = aspect
	attachments.on.pop() // remove ID -> filled in below


	for (let name in m.definitions) {
		const entity = m.definitions[name]
		// Mark entity with '@attachments: { Image: [], Documents: [] }' which
		// contains a list of keys of the associated type 'Image' or 'Document'
		if (hasResources(entity)) {

			const keys = [], { elements: elms } = entity
			for (let e in elms) if (elms[e].key) keys.push(e)

			// Add association to AttachmentsView
			const on = [...attachments.on]; keys.forEach((k, i) => { i && on.push('||'); on.push({ ref: [k] }) })
			const assoc = { ...attachments, on }
			const query = entity.projection || entity.query?.SELECT
			if (query) {
			  (query.columns ??= ['*']).push({ as: 'attachments', cast: assoc })
			} else {
			  entity.elements.attachments = assoc
			}

			// WIP: Add association to Images
			// const srv = name.split('.')[0]
			// const props = entity['@attachments']?.Image
			// if (props?.length > 0 && !srv.startsWith('sap')) {
			// 	console.log('>> Found', props, 'on', name)
			// 	const imageDef = m.definitions[name].elements[props[0]]
			// }

			// Add UI.Facet for AttachmentsView
			entity['@UI.Facets']?.push(facet)

		}
	}

	const sortObject = o => Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {})
	m.definitions = sortObject(m.definitions)
	fs.writeFileSync(path.join(__dirname, 'model-test.csn'), JSON.stringify(m, null, 4), 'utf8')
})

// Independent of the data source (db or remote bucket), stream data
// behind app '/media' url

cds.on('bootstrap', async app => {
	app.get('/media/', async (req, res) => {
		let ID = req.query.ID;
		if (ID) {
			const media_srv = await connectToAttachmentsService()
			// TODO: Get service dynamically
			const stream = await media_srv.onSTREAM('sap.attachments.Images', ID)
			if (stream) {
				res.setHeader('Content-Type', 'application/octet-stream')
				stream.pipe(res)
			}
		}
		return res
	})
})

cds.on('served', async () => {
	for (const srv of cds.services) {
		if (srv instanceof cds.ApplicationService) {

			const { ReadImagesHandler, ReadAttachmentsHandler } = require('./lib')

			let any
			for (const entity of Object.values(srv.entities)) {
				if (entity['@attachments']) {
					any = true
					srv.prepend(() => srv.on("READ", ReadImagesHandler))
				}
			}
			if (any && srv.entities.AttachmentsView) {
				srv.prepend(() => srv.on("READ", srv.entities.AttachmentsView, ReadAttachmentsHandler))
			}
		}
	}
})
