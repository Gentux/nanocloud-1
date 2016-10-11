/**
 * Nanocloud turns any traditional software into a cloud solution, without
 * changing or redeveloping existing source code.
 *
 * Copyright (C) 2016 Nanocloud Software
 *
 * This file is part of Nanocloud.
 *
 * Nanocloud is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Nanocloud is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General
 * Public License
 * along with this program.  If not, see
 * <http://www.gnu.org/licenses/>.
 */

/* globals Machine, MachineService, JsonApiService, Image */

const Promise = require('bluebird');
const uuid = require('node-uuid');
const _ = require('lodash');

module.exports = {

  /*
   * Retrieves images a given user can access
   *
   * @param {Object} a user object (usually req.user)
   * @return {Promise[array]} a promise resolving to an array of Images
   */
  _getImages(user) {

    return new Promise((resolve, reject) => {
      return Image.query({
        text: `SELECT DISTINCT
                 "image".id,
                 "image".name,
                 "image".deleted,
                 "image".password
                 FROM "image"
                 LEFT JOIN "imagegroup" on imagegroup.image = image.id
                 LEFT JOIN "group" on imagegroup.group = "group".id
                 LEFT JOIN "usergroup" on usergroup.group = "group".id
                 WHERE (usergroup.user = $1::varchar OR $2::boolean = true) AND "image".deleted = false`,
        values: [
          user.id,
          user.isAdmin
        ]
      }, (err, images) => {

        if (err) {
          return reject(err);
        }

        return resolve(images);
      });
    });
  },

  create: function(req, res) {

    let machineId = _.get(req, 'body.data.attributes.build-from');
    if (!machineId) {
      return res.badRequest('Invalid base machine ID');
    }

    Machine.findOne(machineId)
      .then((machine) => {

        return MachineService.createImage({
          name: uuid.v4(),
          buildFrom: machine.id
        });
      })
      .then(res.created)
      .catch(res.negotiate);
  },

  findOne: function(req, res) {
    if (req.user.isAdmin) {
      Image.findOne({
        id: req.allParams().id
      })
        .populate('apps')
        .then(res.ok)
        .catch(res.negotiate);
    } else {
      this._getImages(req.user)
        .then((images) => {
          images = images.rows;
          var image = _.find(images, function(element) { return element.id === req.allParams().id; });
          if (image) {
            return res.ok(image);
          }
          return res.notFound();
        });
    }
  },

  find: function(req, res) {

    this._getImages(req.user)
      .then((images) => {
        let imageIds = _.map(images.rows, 'id');
        Image.find(imageIds)
          .populate('apps')
          .then((images) => {
            return res.ok(images);
          });
      })
      .catch(res.negociate);
  },

  destroy: function(req, res) {
    return Image.update({
      id: req.allParams().id
    }, {
      deleted: true
    })
      .then((image) => {
        res.status(202);
        res.send(JsonApiService.serialize('images', image[0]));
      })
      .catch(res.negociate);
  }
};
