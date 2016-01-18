/**
 * @author mrdoob / http://mrdoob.com/
 */

Sidebar.Geometry = function ( editor ) {

	var signals = editor.signals;

	var container = new UI.CollapsiblePanel();
	container.setCollapsed( editor.config.getKey( 'ui/sidebar/geometry/collapsed' ) );
	container.onCollapsedChange( function ( boolean ) {

		editor.config.setKey( 'ui/sidebar/geometry/collapsed', boolean );

	} );
	container.setDisplay( 'none' );

	var geometryType = new UI.Text().setTextTransform( 'uppercase' );
	container.addStatic( geometryType );

	// Actions

	var objectActions = new UI.Select().setPosition('absolute').setRight( '8px' ).setFontSize( '11px' );
	objectActions.setOptions( {

		'Actions': 'Actions',
		'Center': 'Center',
		'Convert': 'Convert',
		'Flatten': 'Flatten'

	} );
	objectActions.onClick( function ( event ) {

		event.stopPropagation(); // Avoid panel collapsing

	} );
	objectActions.onChange( function ( event ) {

		var action = this.getValue();

		var object = editor.selected;
		var geometry = object.geometry;

		if ( confirm( action + ' ' + object.name + '?' ) === false ) return;

		switch ( action ) {

			case 'Center':

				var offset = geometry.center();

				object.position.sub( offset );

				editor.signals.geometryChanged.dispatch( geometry );
				editor.signals.objectChanged.dispatch( object );

				break;

			case 'Convert':

				if ( geometry instanceof THREE.Geometry ) {

					object.geometry = new THREE.BufferGeometry().fromGeometry( geometry );

					signals.geometryChanged.dispatch( object );

				}

				break;

			case 'Flatten':

				geometry.applyMatrix( object.matrix );

				object.position.set( 0, 0, 0 );
				object.rotation.set( 0, 0, 0 );
				object.scale.set( 1, 1, 1 );

				editor.signals.geometryChanged.dispatch( geometry );
				editor.signals.objectChanged.dispatch( object );

				break;

		}

		this.setValue( 'Actions' );

		signals.objectChanged.dispatch( object );

	} );
	container.addStatic( objectActions );

	container.add( new UI.Break() );


	// name

	var geometryNameRow = new UI.Panel();
	var geometryName = new UI.Input().setWidth( '150px' ).setFontSize( '12px' ).onChange( function () {

		editor.setGeometryName( editor.selected.geometry, geometryName.getValue() );

	} );

	geometryNameRow.add( new UI.Text( 'Name' ).setWidth( '90px' ) );
	geometryNameRow.add( geometryName );

	container.add( geometryNameRow );

	// geometry

	container.add( new Sidebar.Geometry.Geometry( signals ) );


	// parameters

	var parameters = new UI.Panel();
	container.add( parameters );


	//

	function build() {

		var object = editor.selected;

		if ( object && object.geometry ) {

			var geometry = object.geometry;

			container.setDisplay( 'block' );

			geometryType.setValue( geometry.type );

			//geometryUUID.setValue( geometry.uuid );
			geometryName.setValue( geometry.name );

			//

			parameters.clear();

			if ( geometry.type === 'BufferGeometry' || geometry.type === 'Geometry' ) {

				parameters.add( new Sidebar.Geometry.Modifiers( signals, object ) );

			} else if ( Sidebar.Geometry[ geometry.type ] !== undefined ) {

				parameters.add( new Sidebar.Geometry[ geometry.type ]( signals, object ) );

			}

		} else {

			container.setDisplay( 'none' );

		}

	}

	signals.objectSelected.add( build );
	signals.geometryChanged.add( build );

	return container;

};
